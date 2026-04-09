import { useState, useEffect, useMemo, useRef, Fragment } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../services/apiService'
import {
  predictDonorChurn, fetchDonorChurnFeatureImportance,
  predictResidentRisk, fetchResidentRiskFeatureImportance,
  predictEducationOutcome,
} from '../../services/mlApi'
import type { DonorChurnInput, ResidentRiskInput, FeatureImportance, EducationOutcomeInput } from '../../services/mlApi'
import type {
  Donation, MonthlyDonationSummary, TopSupporter,
  AllocationSummary, SafehouseMonthlyMetric, Safehouse, Resident, ResidentMlFeatures,
  ProcessRecording, HealthRecord, HomeVisitation, EducationRecord,
} from '../../services/apiService'
import './ReportsPage.css'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function fmtAmt(n: number | null, currency?: string | null) {
  if (n == null) return '—'
  const sym = currency === 'USD' ? '$' : '₱'
  return sym + fmtNum(n)
}

function monthLabel(m: number) {
  return new Date(2000, m - 1, 1).toLocaleString('en-US', { month: 'short' })
}

type Tab = 'donations' | 'outcomes' | 'safehouses' | 'annual'

// ─── SVG Sparkline Chart ───────────────────────────────────────────────────────

const CW = 700, CH = 180
const PAD = { top: 16, right: 16, bottom: 32, left: 56 }
const iW = CW - PAD.left - PAD.right
const iH = CH - PAD.top - PAD.bottom

function LineChart({ data }: { data: MonthlyDonationSummary[] }) {
  if (data.length < 2) return <p className="rp-empty">Not enough data for chart.</p>
  const vals = data.map(d => d.total)
  const maxV = Math.max(...vals, 1)
  const minV = 0
  const xp = (i: number) => PAD.left + (i / (data.length - 1)) * iW
  const yp = (v: number) => PAD.top + iH - ((v - minV) / (maxV - minV)) * iH
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => minV + t * (maxV - minV))
  const polyline = data.map((p, i) => `${xp(i)},${yp(p.total)}`).join(' ')
  const area = `M ${xp(0)} ${yp(data[0].total)} ` +
    data.map((p, i) => `L ${xp(i)} ${yp(p.total)}`).join(' ') +
    ` L ${xp(data.length - 1)} ${PAD.top + iH} L ${PAD.left} ${PAD.top + iH} Z`

  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} className="rp-chart" aria-label="Monthly donation trend">
      {/* Y grid + labels */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={PAD.left} x2={CW - PAD.right} y1={yp(t)} y2={yp(t)} stroke="var(--border-light)" strokeWidth="1" />
          <text x={PAD.left - 6} y={yp(t) + 4} textAnchor="end" fontSize="10" fill="var(--text-muted)">
            {t >= 1000 ? `${Math.round(t / 1000)}k` : Math.round(t)}
          </text>
        </g>
      ))}
      {/* X labels */}
      {data.map((p, i) => (
        <text key={i} x={xp(i)} y={CH - 4} textAnchor="middle" fontSize="10" fill="var(--text-muted)">
          {monthLabel(p.month)}
        </text>
      ))}
      {/* Area */}
      <path d={area} fill="var(--cove-tidal)" opacity="0.1" />
      {/* Line */}
      <polyline points={polyline} fill="none" stroke="var(--cove-tidal)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {/* Dots */}
      {data.map((p, i) => (
        <circle key={i} cx={xp(i)} cy={yp(p.total)} r="5" fill="var(--cove-tidal)" stroke="white" strokeWidth="2" />
      ))}
    </svg>
  )
}

function BarChart({ data, labelKey, valueKey, color = 'var(--cove-tidal)' }: {
  data: Record<string, string | number>[]
  labelKey: string
  valueKey: string
  color?: string
}) {
  if (data.length === 0) return <p className="rp-empty">No data.</p>
  const vals = data.map(d => Number(d[valueKey]))
  const maxV = Math.max(...vals, 1)
  return (
    <div className="rp-bar-list">
      {data.map((d, i) => {
        const v = Number(d[valueKey])
        const p = Math.round((v / maxV) * 100)
        return (
          <div key={i} className="rp-bar-row">
            <span className="rp-bar-label">{String(d[labelKey])}</span>
            <div className="rp-bar-track">
              <div className="rp-bar-fill" style={{ width: `${p}%`, background: color }} />
            </div>
            <span className="rp-bar-value">{v % 1 === 0 ? fmtNum(v) : v.toFixed(1)}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Donor Lapse Risk (ML) ────────────────────────────────────────────────────

interface LapseRow {
  supporterId: number
  name: string
  email: string | null
  total: number
  count: number
  avg: number
  lastDonation: string | null
  daysSinceFirst: number
  variety: number
  recurring: boolean
  probability: number
  reasons: string[]
}

// ── Lapse-risk localStorage cache ────────────────────────────────────────────
const LAPSE_CACHE_KEY = 'cove_lapse_risk_v1'

function loadLapseCache(): { rows: LapseRow[]; ts: number } | null {
  try {
    const raw = localStorage.getItem(LAPSE_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as { rows: LapseRow[]; ts: number }
  } catch { return null }
}

function saveLapseCache(rows: LapseRow[]) {
  try {
    localStorage.setItem(LAPSE_CACHE_KEY, JSON.stringify({ rows, ts: Date.now() }))
  } catch { /* storage quota / private mode */ }
}

function cacheAgeLabel(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

function DonorOKRBanner({ donations, lapseRows }: { donations: Donation[]; lapseRows: LapseRow[] }) {
  const { retentionRate, priorYearCount, highRiskCount } = useMemo(() => {
    const now = new Date()
    const last12Start = new Date(now)
    last12Start.setFullYear(now.getFullYear() - 1)
    const prior12Start = new Date(now)
    prior12Start.setFullYear(now.getFullYear() - 2)

    const priorYearDonors = new Set<number>()
    const recentDonors = new Set<number>()

    for (const d of donations) {
      if (d.supporterId == null || !d.donationDate) continue
      const ts = new Date(d.donationDate).getTime()
      if (Number.isNaN(ts)) continue

      if (ts >= prior12Start.getTime() && ts < last12Start.getTime()) {
        priorYearDonors.add(d.supporterId)
      }
      if (ts >= last12Start.getTime() && ts <= now.getTime()) {
        recentDonors.add(d.supporterId)
      }
    }

    let retained = 0
    for (const id of priorYearDonors) {
      if (recentDonors.has(id)) retained += 1
    }

    const retention = priorYearDonors.size > 0 ? (retained / priorYearDonors.size) * 100 : 0
    const highRisk = lapseRows.filter(r => r.probability >= 0.85).length

    return {
      retentionRate: retention,
      priorYearCount: priorYearDonors.size,
      highRiskCount: highRisk,
    }
  }, [donations, lapseRows])

  const retentionStatus = retentionRate >= 40 ? 'ok' : retentionRate >= 25 ? 'warn' : 'bad'
  const retentionProgress = Math.min(100, Math.max(0, (retentionRate / 40) * 100))

  const highRiskStatus = highRiskCount <= 10 ? 'ok' : highRiskCount <= 20 ? 'warn' : 'bad'
  const highRiskProgress = highRiskCount <= 10
    ? 100
    : Math.max(0, Math.min(100, ((20 - highRiskCount) / 10) * 100))

  return (
    <section className="rp-okr-banner" aria-label="Donor OKR summary">
      <div className="rp-okr-grid">
        <article className="rp-okr-card">
          <div className="rp-okr-label">OBJECTIVE</div>
          <p className="rp-okr-objective"><strong>Retain existing donors</strong></p>
          <div className="rp-okr-value">{Math.round(retentionRate)}%</div>
          <p className="rp-okr-target">
            Target: 40%
            {priorYearCount > 0 ? ` (${priorYearCount} prior-year donors)` : ''}
          </p>
          <div className="rp-okr-track">
            <div className={`rp-okr-fill rp-okr-fill-${retentionStatus}`} style={{ width: `${retentionProgress}%` }} />
          </div>
        </article>

        <article className="rp-okr-card">
          <div className="rp-okr-label">OBJECTIVE</div>
          <p className="rp-okr-objective"><strong>Reduce high-risk donor lapse</strong></p>
          <div className="rp-okr-value">{highRiskCount} donors</div>
          <p className="rp-okr-target">Target: fewer than 10 · {highRiskCount} donors need outreach</p>
          <div className="rp-okr-track">
            <div className={`rp-okr-fill rp-okr-fill-${highRiskStatus}`} style={{ width: `${highRiskProgress}%` }} />
          </div>
        </article>
      </div>
    </section>
  )
}

function resolveAcquisitionChannel(raw: unknown): string {
  const s = raw as {
    acquisitionChannel?: string | null
    acquisition_channel?: string | null
    acq_channel?: string | null
    channelSource?: string | null
  }
  return (
    s.acquisitionChannel?.trim() ||
    s.acquisition_channel?.trim() ||
    s.acq_channel?.trim() ||
    s.channelSource?.trim() ||
    'Unknown'
  )
}

/** Exclude missing/placeholder segment keys from retention charts (not real segments). */
function isValidRetentionSegmentKey(key: string | null | undefined): boolean {
  if (key == null) return false
  const t = String(key).trim()
  if (t === '') return false
  return t.toLowerCase() !== 'unknown'
}

/** Normalize channel strings for matching (handles WordOfMouth, "Word of Mouth", word_of_mouth). */
function canonicalAcquisitionChannel(key: string): string {
  return key.replace(/[\s_-]/g, '').toLowerCase()
}

/**
 * Channels the org meaningfully acquired donors through (callout uses these only).
 * Website is treated as passive like Word of Mouth / Church (donation route, not acquisition source).
 */
const ACTIVE_ACQUISITION_CHANNELS = new Set(['socialmedia', 'event', 'partnerreferral'])

function isActiveAcquisitionChannel(key: string): boolean {
  return ACTIVE_ACQUISITION_CHANNELS.has(canonicalAcquisitionChannel(key))
}

const ACQUISITION_CHANNEL_DISPLAY: Record<string, string> = {
  wordofmouth: 'Word of Mouth',
  socialmedia: 'Social Media',
  partnerreferral: 'Partner Referral',
  website: 'Website',
  event: 'Event',
  church: 'Church',
}

/** Human-readable labels for acquisition channel keys (chart + callouts). */
function formatAcquisitionChannelDisplay(key: string): string {
  const c = canonicalAcquisitionChannel(key)
  if (ACQUISITION_CHANNEL_DISPLAY[c]) return ACQUISITION_CHANNEL_DISPLAY[c]
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, ch => ch.toUpperCase())
}

function deriveReasons(input: {
  count: number
  avg: number
  lastDonation: string | null
  daysSinceFirst: number
  variety: number
  recurring: boolean
}): string[] {
  const reasons: string[] = []
  const daysSinceLast = input.lastDonation
    ? Math.round((Date.now() - new Date(input.lastDonation).getTime()) / 86_400_000)
    : null

  if (input.avg < 200) reasons.push('Small average gift')
  if (daysSinceLast != null && daysSinceLast > 365) reasons.push(`Silent ${Math.round(daysSinceLast / 30)}+ months`)
  else if (daysSinceLast != null && daysSinceLast > 180) reasons.push('No gift in 6+ months')
  if (input.daysSinceFirst < 90 && input.count <= 2) reasons.push('New donor, few gifts')
  if (input.count >= 3 && !input.recurring) reasons.push('Not recurring')
  if (input.variety === 1 && input.count >= 3) reasons.push('Single channel only')

  return reasons.slice(0, 2)
}

type RiskFilter = 'all' | 'high' | 'medium' | 'low'

function riskOf(p: number): 'high' | 'medium' | 'low' {
  return p >= 0.7 ? 'high' : p >= 0.4 ? 'medium' : 'low'
}

const FEATURE_LABELS: Record<string, string> = {
  total_donation_count: 'Total donation count',
  total_amount: 'Total amount given',
  avg_donation_amount: 'Average donation',
  days_since_first_donation: 'Days since first donation',
  donation_type_variety: 'Donation type variety',
  is_recurring_donor: 'Recurring donor',
}

function prettifyFeature(name: string): string {
  if (FEATURE_LABELS[name]) return FEATURE_LABELS[name]
  if (name.startsWith('acq_')) {
    return 'Acquisition: ' + name.slice(4).replace(/_/g, ' ')
  }
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function buildOutreachMailto(r: LapseRow): string {
  if (!r.email) return '#'
  const firstName = r.name.split(/\s+/)[0] || 'there'
  const lastGift = r.lastDonation
    ? new Date(r.lastDonation).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : 'a while ago'
  const subject = `We miss you, ${firstName}`
  const body =
    `Hi ${firstName},\n\n` +
    `It's been since ${lastGift} that we last heard from you, and the team at Cove wanted to ` +
    `reach out and say thank you for the ${r.count} gift${r.count === 1 ? '' : 's'} you've made ` +
    `to support our work. Your generosity has made a real difference for the residents we serve.\n\n` +
    `If there's anything we can share about how your past support has been used, or if you'd like ` +
    `to talk about how to stay involved, just hit reply — I'd love to hear from you.\n\n` +
    `With gratitude,\nThe Cove team`
  return `mailto:${r.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function buildChurnInput(rows: Donation[]): DonorChurnInput {
  const count = rows.length
  const total = rows.reduce((s, d) => s + (d.amount ?? 0), 0)
  const avg = count ? total / count : 0
  const firstTs = rows
    .map(d => (d.donationDate ? new Date(d.donationDate).getTime() : NaN))
    .filter(n => !Number.isNaN(n))
  const first = firstTs.length ? Math.min(...firstTs) : Date.now()
  const days = Math.max(0, Math.round((Date.now() - first) / 86_400_000))
  const variety = new Set(rows.map(d => d.donationType ?? 'Unknown')).size
  const recurring = rows.some(d => d.isRecurring === true)
  return {
    total_donation_count: count,
    total_amount: total,
    avg_donation_amount: avg,
    days_since_first_donation: days,
    donation_type_variety: variety,
    is_recurring_donor: recurring,
  }
}

const LAPSE_PAGE_SIZE = 10

function LapseRiskPanel({
  donations,
  currency,
  onRowsChange,
}: {
  donations: Donation[]
  currency: string
  onRowsChange?: (rows: LapseRow[]) => void
}) {
  // Seed state from cache immediately so the table is visible on first render
  const initialCache = loadLapseCache()
  const [rows, setRows] = useState<LapseRow[]>(initialCache?.rows ?? [])
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>(
    initialCache ? 'done' : 'idle',
  )
  const [cacheTs, setCacheTs] = useState<number | null>(initialCache?.ts ?? null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState<RiskFilter>('all')
  const [emailMap, setEmailMap] = useState<Map<number, string | null>>(new Map())
  const [featureImportance, setFeatureImportance] = useState<FeatureImportance[]>([])
  const [channelMap, setChannelMap] = useState<Map<number, string>>(new Map())
  const [showModelDrivers, setShowModelDrivers] = useState(false)
  const [showInsights, setShowInsights] = useState(false)

  useEffect(() => {
    onRowsChange?.(rows)
  }, [rows, onRowsChange])

  useEffect(() => {
    fetchDonorChurnFeatureImportance()
      .then(setFeatureImportance)
      .catch(() => { /* non-fatal */ })
  }, [])

  useEffect(() => {
    let cancelled = false
    api.getSupporters()
      .then(list => {
        if (cancelled) return
        const m = new Map<number, string | null>()
        const c = new Map<number, string>()
        if (list.length > 0) {
          console.log('[RetentionInsights] first donor object:', list[0])
        }
        for (const s of list) m.set(s.supporterId, s.email)
        for (const s of list) c.set(s.supporterId, resolveAcquisitionChannel(s))
        setEmailMap(m)
        setChannelMap(c)
      })
      .catch(() => { /* email column will show — */ })
    return () => { cancelled = true }
  }, [])

  const hasAutoRun = useRef(false)

  const perDonor = useMemo(() => {
    const map = new Map<number, { name: string; rows: Donation[] }>()
    for (const d of donations) {
      if (d.supporterId == null) continue
      const entry = map.get(d.supporterId) ?? { name: d.supporterName, rows: [] }
      entry.rows.push(d)
      map.set(d.supporterId, entry)
    }
    return map
  }, [donations])

  async function runPredictions(background = false) {
    if (background) {
      setRefreshing(true)
    } else {
      setStatus('loading')
      setError(null)
    }
    try {
      const entries = Array.from(perDonor.entries())
      // Batch into groups of 8 to avoid overwhelming the ML API on cold starts
      const BATCH = 8
      const results: LapseRow[] = []
      for (let i = 0; i < entries.length; i += BATCH) {
        const batch = entries.slice(i, i + BATCH)
        const settled = await Promise.allSettled(
          batch.map(async ([supporterId, { name, rows: dRows }]) => {
            const input = buildChurnInput(dRows)
            const res = await predictDonorChurn(input)
            const lastTs = dRows
              .map(d => (d.donationDate ? new Date(d.donationDate).getTime() : NaN))
              .filter(n => !Number.isNaN(n))
            const lastDonation = lastTs.length ? new Date(Math.max(...lastTs)).toISOString() : null
            const reasons = deriveReasons({
              count: input.total_donation_count,
              avg: input.avg_donation_amount,
              lastDonation,
              daysSinceFirst: input.days_since_first_donation,
              variety: input.donation_type_variety,
              recurring: input.is_recurring_donor,
            })
            return {
              supporterId,
              name,
              email: emailMap.get(supporterId) ?? null,
              total: input.total_amount,
              count: input.total_donation_count,
              avg: input.avg_donation_amount,
              lastDonation,
              daysSinceFirst: input.days_since_first_donation,
              variety: input.donation_type_variety,
              recurring: input.is_recurring_donor,
              probability: res.probability,
              reasons,
            }
          }),
        )
        for (const r of settled) {
          if (r.status === 'fulfilled') results.push(r.value)
        }
      }
      if (results.length === 0 && !background) {
        setError('No predictions returned — the ML API may be warming up. Try again in a moment.')
        setStatus('error')
        return
      }
      results.sort((a, b) => b.probability - a.probability)
      saveLapseCache(results)
      setCacheTs(null)
      setRows(results)
      setPage(0)
      setFilter('all')
      setStatus('done')
    } catch (e) {
      if (!background) {
        setError(e instanceof Error ? e.message : 'Prediction failed')
        setStatus('error')
      }
      // background failure: keep showing cached rows silently
    } finally {
      setRefreshing(false)
    }
  }

  // Auto-run scoring once donor data is available.
  // If we have cached rows, run a silent background refresh instead of blocking.
  useEffect(() => {
    if (hasAutoRun.current) return
    if (perDonor.size === 0) return
    hasAutoRun.current = true
    const hasCached = rows.length > 0
    void runPredictions(hasCached)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perDonor])

  const counts = useMemo(() => {
    let high = 0, medium = 0, low = 0
    let dollarsHigh = 0, dollarsMedium = 0, dollarsLow = 0
    for (const r of rows) {
      const k = riskOf(r.probability)
      if (k === 'high') { high++; dollarsHigh += r.total }
      else if (k === 'medium') { medium++; dollarsMedium += r.total }
      else { low++; dollarsLow += r.total }
    }
    return { high, medium, low, all: rows.length, dollarsHigh, dollarsMedium, dollarsLow }
  }, [rows])

  const filteredRows = useMemo(() => {
    if (filter === 'all') return rows
    return rows
      .filter(r => riskOf(r.probability) === filter)
      .sort((a, b) => b.total - a.total)
  }, [rows, filter])

  const retentionInsights = useMemo(() => {
    type Bucket = { group: string; lapseRate: number; count: number; impact: number }
    const idsWithScores = new Set(rows.map(r => r.supporterId))
    const scoreById = new Map(rows.map(r => [r.supporterId, r.probability]))

    const bucketFromIds = (group: string, ids: number[]): Bucket | null => {
      const scored = ids
        .filter(id => idsWithScores.has(id))
        .map(id => scoreById.get(id) ?? 0)
      const lapsed = scored.filter(p => p >= 0.5).length
      const count = scored.length
      if (count === 0) return null
      const lapseRate = (lapsed / count) * 100
      const impact = lapseRate * count
      return { group, lapseRate, count, impact }
    }

    const toCampaignBuckets = (groups: Map<string, number[]>): Bucket[] =>
      Array.from(groups.entries())
        .filter(([group]) => isValidRetentionSegmentKey(group))
        .map(([group, ids]) => bucketFromIds(group, ids))
        .filter((x): x is Bucket => x != null)
        .sort((a, b) => b.lapseRate - a.lapseRate)

    const byChannelMap = new Map<string, number[]>()
    rows.forEach(r => {
      const key = channelMap.get(r.supporterId) ?? 'Unknown'
      byChannelMap.set(key, [...(byChannelMap.get(key) ?? []), r.supporterId])
    })

    const byChannel: Bucket[] = Array.from(byChannelMap.entries())
      .filter(([group]) => isValidRetentionSegmentKey(group))
      .map(([group, ids]) => bucketFromIds(group, ids))
      .filter((x): x is Bucket => x != null && x.count >= 3)
      .sort((a, b) => b.impact - a.impact)

    const byCampaignMap = new Map<string, number[]>()
    rows.forEach(r => {
      const latest = donations
        .filter(d => d.supporterId === r.supporterId)
        .slice()
        .sort((a, b) => {
          const aTs = a.donationDate ? new Date(a.donationDate).getTime() : 0
          const bTs = b.donationDate ? new Date(b.donationDate).getTime() : 0
          return bTs - aTs
        })[0]
      const campaign = latest?.campaignName?.trim() || 'Unknown'
      byCampaignMap.set(campaign, [...(byCampaignMap.get(campaign) ?? []), r.supporterId])
    })

    return {
      byChannel,
      byCampaign: toCampaignBuckets(byCampaignMap),
    }
  }, [rows, donations, channelMap])

  const retentionCallouts = useMemo(() => {
    const formatNames = (names: string[]) => {
      if (names.length === 0) return ''
      if (names.length === 1) return names[0]
      if (names.length === 2) return `${names[0]} and ${names[1]}`
      return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
    }

    const channelRows = retentionInsights.byChannel
    const campaignRows = retentionInsights.byCampaign

    const activeChannelRows = channelRows.filter(r => isActiveAcquisitionChannel(r.group))
    const topActiveImpact = activeChannelRows[0]
    const channelCallout = topActiveImpact
      ? `${formatAcquisitionChannelDisplay(topActiveImpact.group)} has the highest retention impact — ${topActiveImpact.lapseRate.toFixed(1)}% of ${topActiveImpact.count} donors lapsed, making it your biggest retention opportunity.`
      : channelRows.length === 0
        ? 'Not enough channel data to generate retention guidance yet.'
        : 'No active acquisition channel (social media, events, or partner referrals) has enough data to highlight yet. Passive channels such as Word of Mouth, Church, and Website are excluded from this recommendation.'

    const fullyLapsedCampaigns = campaignRows
      .filter(c => Math.round(c.lapseRate) === 100)
      .map(c => c.group)
    const bestCampaign = campaignRows.length > 0 ? campaignRows[campaignRows.length - 1].group : null

    let campaignCallout = 'Not enough campaign data to generate retention guidance yet.'
    if (bestCampaign && fullyLapsedCampaigns.length > 0) {
      const label = formatNames(fullyLapsedCampaigns)
      const verb = fullyLapsedCampaigns.length === 1 ? 'never gives' : 'never give'
      campaignCallout = `${label} donors ${verb} again. ${bestCampaign} retains the most donors — replicate its approach in future campaigns.`
    } else if (bestCampaign) {
      campaignCallout = `${bestCampaign} retains the most donors — replicate its approach in future campaigns.`
    }

    return { channelCallout, campaignCallout }
  }, [retentionInsights])

  const segBarClass = (rate: number) => {
    if (rate >= 80) return 'rp-seg-bar-critical'
    if (rate >= 67) return 'rp-seg-bar-warn'
    return 'rp-seg-bar-ok'
  }

  const segCallout = (vals: { group: string; lapseRate: number }[], sortByImpact?: boolean) => {
    if (vals.length === 0) return 'Not enough scored data yet.'
    if (sortByImpact) {
      return 'Bars sorted by retention impact (lapse rate × donor count). Passive channels (e.g. Word of Mouth, Church, Website) may appear but the insight above focuses on channels you control.'
    }
    const sorted = vals.slice().sort((a, b) => b.lapseRate - a.lapseRate)
    const high = sorted[0]
    const low = sorted[sorted.length - 1]
    return `Highest lapse rate: ${high.group} (${high.lapseRate.toFixed(1)}%) · Lowest: ${low.group} (${low.lapseRate.toFixed(1)}%)`
  }

  return (
    <div className="rp-section">
      <div className="rp-lapse-header">
        <div>
          <h3 className="rp-section-title" style={{ marginBottom: 'var(--space-xs)' }}>Donor Lapse Risk</h3>
          <p className="rp-empty" style={{ textAlign: 'left', margin: 0, padding: 0 }}>
            Donors most likely to stop giving, ranked from highest to lowest risk.
          </p>
          {cacheTs && (
            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Showing cached scores from {cacheAgeLabel(cacheTs)}
              {refreshing ? ' · Updating in background…' : ''}
            </p>
          )}
          {!cacheTs && refreshing && (
            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Refreshing scores…
            </p>
          )}
        </div>
        {status === 'done' && !refreshing && (
          <button
            type="button"
            className="rp-tab-btn rp-refresh-btn"
            onClick={() => runPredictions(false)}
          >
            Refresh scores
          </button>
        )}
        {refreshing && (
          <span style={{ fontSize: '0.8rem', color: 'var(--cove-tidal)', fontWeight: 600 }}>
            Updating…
          </span>
        )}
      </div>
      {status === 'loading' && (
        <p className="rp-empty" style={{ textAlign: 'left' }}>
          Scoring {perDonor.size} donors…
        </p>
      )}
      {error && <p className="rp-empty" style={{ color: 'var(--color-error)' }}>{error}</p>}
      {featureImportance.length > 0 && (
        <div className="rp-collapsible">
          <button className="rp-collapsible-btn" onClick={() => setShowModelDrivers(v => !v)}>
            {showModelDrivers ? 'Hide model drivers' : 'Show model drivers'}
          </button>
          {showModelDrivers && (
            <div className="lapse-importance">
              <div className="lapse-importance-header">
                <h4 className="lapse-importance-title">What predicts donor lapse</h4>
                <span className="lapse-importance-sub">
                  The bigger the bar, the more this factor influences whether a donor is likely to lapse
                </span>
              </div>
              <div className="lapse-importance-list">
                {featureImportance.map(f => {
                  const pct = f.importance * 100
                  const barWidth = Math.max(2, (f.importance / featureImportance[0].importance) * 100)
                  return (
                    <div key={f.feature} className="lapse-importance-row">
                      <span className="lapse-importance-label">{prettifyFeature(f.feature)}</span>
                      <div className="lapse-importance-track">
                        <div
                          className="lapse-importance-fill"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <span className="lapse-importance-value">{pct.toFixed(1)}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
      {status === 'done' && rows.length > 0 && (
        <div className="rp-collapsible" style={{ marginTop: 'var(--space-md)' }}>
          <button className="rp-collapsible-btn" onClick={() => setShowInsights(v => !v)}>
            {showInsights ? 'Hide why donors stop giving' : 'Show why donors stop giving'}
          </button>
          {showInsights && (
        <div className="rp-seg-section">
          <div className="rp-seg-head">
            <h4 className="rp-card-title">Why Donors Stop Giving</h4>
            <p className="rp-seg-lede">
              Every bar shows the percentage of donors from that source who eventually stopped giving. Lower is better.
            </p>
          </div>
          <div className="rp-seg-grid">
            {([
              { title: 'By Acquisition Channel' as const, rows: retentionInsights.byChannel },
              { title: 'By Campaign' as const, rows: retentionInsights.byCampaign },
            ] as const).map(card => {
              const shown = card.rows.slice(0, 6)
              const maxDonors =
                card.title === 'By Acquisition Channel' && shown.length > 0
                  ? Math.max(...shown.map(r => r.count))
                  : 0
              return (
              <div key={card.title} className="rp-card">
                <h4 className="rp-seg-title">{card.title}</h4>
                <div className="rp-seg-rows">
                  {shown.map(r => (
                    <div key={r.group} className="rp-seg-row">
                      {card.title === 'By Acquisition Channel' ? (
                        <>
                          <div className="rp-seg-row-head rp-seg-row-head-channel">
                            <div className="rp-seg-row-labels">
                              <span className="rp-seg-row-name">
                                {formatAcquisitionChannelDisplay(r.group)}
                              </span>
                              <div className="rp-seg-row-meta">
                                <span className="rp-seg-row-count">{r.count} donors</span>
                                <div
                                  className="rp-seg-count-track"
                                  aria-hidden
                                  title="Relative sample size among channels shown"
                                >
                                  <div
                                    className="rp-seg-count-fill"
                                    style={{
                                      width: `${maxDonors > 0 ? Math.max(8, (r.count / maxDonors) * 100) : 0}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                            <span className="rp-seg-row-pct">{r.lapseRate.toFixed(1)}%</span>
                          </div>
                          <div className="rp-seg-track">
                            <div
                              className={`rp-seg-bar ${segBarClass(r.lapseRate)}`}
                              style={{ width: `${Math.max(2, Math.min(100, r.lapseRate))}%` }}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="rp-seg-row-head">
                            <span>{r.group}</span>
                            <span>{r.lapseRate.toFixed(1)}%</span>
                          </div>
                          <div className="rp-seg-track">
                            <div
                              className={`rp-seg-bar ${segBarClass(r.lapseRate)}`}
                              style={{ width: `${Math.max(2, Math.min(100, r.lapseRate))}%` }}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                {card.rows.length > 6 && (
                  <p className="rp-empty" style={{ textAlign: 'left', marginTop: '6px', padding: 0 }}>
                    {card.title === 'By Acquisition Channel'
                      ? 'Showing top 6 channels by retention impact.'
                      : 'Showing top 6 groups by lapse rate.'}
                  </p>
                )}
                <p className="rp-empty" style={{ textAlign: 'left', marginTop: 'var(--space-sm)', padding: 0 }}>
                  {segCallout(card.rows, card.title === 'By Acquisition Channel')}
                </p>
                {card.title === 'By Acquisition Channel' && (
                  <>
                    <div className="rp-insight-callout">
                      <span className="rp-insight-icon">💡</span>
                      <span>
                        {retentionCallouts.channelCallout}
                      </span>
                    </div>
                    <p className="rp-insight-note">
                      Event donors also show 100% lapse — consider reviewing your post-event follow-up process.
                    </p>
                  </>
                )}
                {card.title === 'By Campaign' && (
                  <div className="rp-insight-callout">
                    <span className="rp-insight-icon">💡</span>
                    <span>
                      {retentionCallouts.campaignCallout}
                    </span>
                  </div>
                )}
              </div>
              )
            })}
          </div>
        </div>
          )}
        </div>
      )}

      {status === 'done' && rows.length > 0 && (
        <div className="lapse-risk-boxes">
          {([
            { key: 'high', label: 'High Risk', count: counts.high, dollars: counts.dollarsHigh, tone: 'var(--color-error)', bg: '#fee2e2' },
            { key: 'medium', label: 'Medium Risk', count: counts.medium, dollars: counts.dollarsMedium, tone: 'var(--color-warning)', bg: '#fef3c7' },
            { key: 'low', label: 'Low Risk', count: counts.low, dollars: counts.dollarsLow, tone: 'var(--color-success)', bg: '#d1fae5' },
          ] as const).map(box => {
            const active = filter === box.key
            return (
              <button
                key={box.key}
                type="button"
                onClick={() => { setFilter(active ? 'all' : box.key); setPage(0) }}
                className="lapse-risk-box"
                style={{
                  borderLeft: `4px solid ${box.tone}`,
                  background: active ? box.bg : 'white',
                  outline: active ? `2px solid ${box.tone}` : 'none',
                }}
              >
                <span style={{ fontSize: '2rem', fontWeight: 700, color: box.tone, lineHeight: 1 }}>
                  {box.count}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  {box.label}
                </span>
                <span className="lapse-risk-box-dollars">
                  {fmtAmt(box.dollars, currency)} lifetime giving
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {active ? 'Click to clear filter' : 'Click to filter'}
                </span>
              </button>
            )
          })}
        </div>
      )}
      {status === 'done' && filter !== 'all' && (
        <div style={{ marginTop: 'var(--space-sm)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Showing {filter} risk donors only ·{' '}
          <button
            type="button"
            onClick={() => { setFilter('all'); setPage(0) }}
            style={{ background: 'none', border: 'none', color: 'var(--cove-tidal)', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
          >
            show all
          </button>
        </div>
      )}
      {status === 'done' && (
        <table className="rp-table rp-table-wide" style={{ marginTop: 'var(--space-md)' }}>
          <thead>
            <tr>
              <th>Donor</th>
              <th>Email</th>
              <th>Donations</th>
              <th>Total Given</th>
              <th>Last Donation</th>
              <th>Lapse Probability</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.slice(page * LAPSE_PAGE_SIZE, (page + 1) * LAPSE_PAGE_SIZE).map(r => {
              const pct = Math.round(r.probability * 100)
              const tone =
                r.probability >= 0.7 ? 'var(--color-error)'
                : r.probability >= 0.4 ? 'var(--color-warning)'
                : 'var(--color-success)'
              return (
                <tr key={r.supporterId}>
                  <td className="rp-td-name">
                    <div>{r.name}</div>
                    {r.reasons.length > 0 && (
                      <div className="lapse-reasons">
                        {r.reasons.map(reason => (
                          <span key={reason} className="lapse-reason-chip">{reason}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: '0.82rem' }}>
                    {r.email ? (
                      <a
                        href={buildOutreachMailto(r)}
                        style={{ color: 'var(--cove-tidal)' }}
                      >
                        {r.email}
                      </a>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td className="rp-td-num">{r.count}</td>
                  <td className="rp-td-num">{fmtAmt(r.total, currency)}</td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{fmtDate(r.lastDonation)}</td>
                  <td>
                    <div className="rp-mini-track">
                      <div className="rp-mini-fill" style={{ width: `${pct}%`, background: tone }} />
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{pct}%</span>
                  </td>
                  <td style={{ color: tone, fontWeight: 600 }}>
                    {r.probability >= 0.7 ? 'High' : r.probability >= 0.4 ? 'Medium' : 'Low'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {status === 'done' && filteredRows.length > LAPSE_PAGE_SIZE && (() => {
        const totalPages = Math.ceil(filteredRows.length / LAPSE_PAGE_SIZE)
        const start = page * LAPSE_PAGE_SIZE + 1
        const end = Math.min((page + 1) * LAPSE_PAGE_SIZE, filteredRows.length)
        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-md)',
              marginTop: 'var(--space-md)',
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
            }}
          >
            <span>
              Showing {start}–{end} of {filteredRows.length}
              {filter === 'all' ? ' (sorted highest risk first)' : ` ${filter} risk · sorted by total given`}
            </span>
            <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
              <button
                type="button"
                className="rp-tab-btn"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Previous
              </button>
              <span style={{ alignSelf: 'center', padding: '0 var(--space-sm)' }}>
                Page {page + 1} of {totalPages}
              </span>
              <button
                type="button"
                className="rp-tab-btn"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Next
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ─── Donation goal presets (hard-coded; no custom goal in DB or settings UI yet) ─

const DONATION_GOALS = [
  { label: 'Essential Ops',     amount: 11_000,  desc: 'Minimum to keep doors open monthly' },
  { label: 'Full Capacity',     amount: 25_000,  desc: 'All programs fully staffed & funded' },
  { label: 'Wheels of Hope',    amount: 35_000,  desc: 'One-time transportation campaign' },
  { label: 'Shelter Expansion', amount: 100_000, desc: 'Capital goal — 18 additional beds' },
]

type TrendRange = '1M' | '3M' | '1Y' | 'all'

const RANGE_LABELS: Record<TrendRange, string> = {
  '1M':  'This Month',
  '3M':  'Last 3 Months',
  '1Y':  'This Year',
  'all': 'All Time',
}

// ─── Tab: Donations ────────────────────────────────────────────────────────────

function DonationsTab({
  donations, monthly, topDonors, allocation, loading, onLapseRowsChange, lapseRows,
}: {
  donations: Donation[]
  monthly: MonthlyDonationSummary[]
  topDonors: TopSupporter[]
  allocation: AllocationSummary | null
  loading: boolean
  onLapseRowsChange?: (rows: LapseRow[]) => void
  lapseRows: LapseRow[]
}) {
  const [trendRange,   setTrendRange]   = useState<TrendRange>('1Y')
  /** Default index 1 = "Full Capacity" ($25,000) — users pick other presets via buttons only. */
  const [selectedGoal, setSelectedGoal] = useState(1)

  const now = new Date()
  const curYear = now.getFullYear()
  const curMonth = now.getMonth() + 1
  const ytd = monthly.filter(m => m.year === curYear).reduce((s, m) => s + m.total, 0)
  const thisMonth = monthly.find(m => m.year === curYear && m.month === curMonth)
  const total = donations.reduce((s, d) => s + (d.amount ?? 0), 0)
  const avg = donations.length ? total / donations.length : 0
  const recurring = donations.filter(d => d.isRecurring).length
  const currency = donations[0]?.currencyCode ?? 'USD'

  const filteredMonthly: MonthlyDonationSummary[] = (() => {
    if (trendRange === '1M')  return monthly.slice(-1)
    if (trendRange === '3M')  return monthly.slice(-3)
    if (trendRange === '1Y')  return monthly.slice(-12)
    return monthly
  })()

  const rangeTotal = filteredMonthly.reduce((s, m) => s + m.total, 0)
  const goal       = DONATION_GOALS[selectedGoal]
  const goalPct    = Math.min(100, Math.round((rangeTotal / goal.amount) * 100))
  const goalLeft   = Math.max(0, goal.amount - rangeTotal)

  const channelCounts: Record<string, number> = {}
  for (const d of donations) {
    const k = d.channelSource ?? 'Unknown'
    channelCounts[k] = (channelCounts[k] ?? 0) + 1
  }
  const channels = Object.entries(channelCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }))

  return (
    <div className="rp-tab-content">
      {lapseRows.length > 0 && (
        <DonorOKRBanner donations={donations} lapseRows={lapseRows} />
      )}

      <div className="rp-kpi-grid">
        {[
          { label: 'YTD Total', value: fmtAmt(ytd, currency), sub: `${monthly.filter(m => m.year === curYear).reduce((s, m) => s + m.count, 0)} donations` },
          { label: 'This Month', value: fmtAmt(thisMonth?.total ?? 0, currency), sub: `${thisMonth?.count ?? 0} donations` },
          { label: 'Average Gift', value: fmtAmt(avg, currency), sub: `${donations.length} total on record` },
          { label: 'Recurring Donors', value: String(recurring), sub: `of ${donations.length} total donations` },
        ].map(k => (
          <div key={k.label} className="rp-kpi">
            <div className="rp-kpi-label">{k.label}</div>
            <div className="rp-kpi-value">{k.value}</div>
            <div className="rp-kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Fundraising goal + monthly trend (one section; time range applies to both) ── */}
      <div className="rp-section rp-goal-trend-section">
        <div className="rp-goal-trend-top">
          <div className="rp-goal-trend-title-block">
            <h3 className="rp-goal-trend-main-title">Fundraising goal & monthly trend</h3>
            <p className="rp-goal-period">{RANGE_LABELS[trendRange]}</p>
          </div>
          <div className="rp-range-toggle" aria-label="Time range for goal and chart">
            {(['1M', '3M', '1Y', 'all'] as const).map(r => (
              <button
                key={r}
                type="button"
                className={`rp-range-btn${trendRange === r ? ' rp-range-active' : ''}`}
                onClick={() => setTrendRange(r)}
              >
                {r === 'all' ? 'All' : r}
              </button>
            ))}
          </div>
        </div>

        <div className="rp-goal-body">
          <div className="rp-goal-presets-row">
            <span className="rp-goal-presets-label">Goal target</span>
            <div className="rp-goal-presets">
              {DONATION_GOALS.map((g, i) => (
                <button
                  key={g.label}
                  type="button"
                  className={`rp-goal-preset${selectedGoal === i ? ' rp-goal-preset-active' : ''}`}
                  onClick={() => setSelectedGoal(i)}
                  title={g.desc}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rp-goal-amounts">
            <span className="rp-goal-raised">{fmtAmt(rangeTotal, currency)}</span>
            <span className="rp-goal-of"> raised of </span>
            <span className="rp-goal-target">{fmtAmt(goal.amount, 'USD')}</span>
            <span className={`rp-goal-pct-badge${goalPct >= 100 ? ' rp-goal-pct-done' : ''}`}>{goalPct}%</span>
          </div>

          <div className="rp-goal-track">
            {[25, 50, 75].map(m => (
              <div key={m} className="rp-goal-milestone" style={{ left: `${m}%` }} />
            ))}
            <div
              className={`rp-goal-fill${goalPct >= 100 ? ' rp-goal-fill-done' : ''}`}
              style={{ width: `${goalPct}%` }}
            />
          </div>

          <div className="rp-goal-footer">
            <span className="rp-goal-desc">{goal.desc}</span>
            <span className="rp-goal-remaining">
              {goalPct >= 100 ? 'Goal reached!' : `${fmtAmt(goalLeft, 'USD')} to go`}
            </span>
          </div>
        </div>

        <div className="rp-goal-trend-chart">
          <h4 className="rp-goal-chart-heading">Monthly donation volume</h4>
          {loading ? <p className="rp-empty">Loading…</p> : <LineChart data={filteredMonthly} />}
        </div>
      </div>

      <div className="rp-two-col">
        <div className="rp-card">
          <h3 className="rp-card-title">Top Supporters</h3>
          <table className="rp-table">
            <thead><tr><th>Name</th><th>Total Given</th><th>Recurring</th><th>Since</th></tr></thead>
            <tbody>
              {topDonors.map(t => (
                <tr key={t.supporterId}>
                  <td>{t.name}</td>
                  <td className="rp-td-num">{fmtAmt(t.total, currency)}</td>
                  <td>{t.isRecurring ? 'Yes' : 'No'}</td>
                  <td>{t.firstDate ? new Date(t.firstDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rp-card">
          <h3 className="rp-card-title">Donation Channels</h3>
          <BarChart
            data={channels.map(c => ({ label: c.label, count: c.count }))}
            labelKey="label"
            valueKey="count"
            color="var(--cove-seaglass)"
          />
        </div>
      </div>

      {allocation && (
        <div className="rp-section">
          <h3 className="rp-section-title">Allocation by Program Area</h3>
          <div className="rp-alloc-grid">
            {allocation.breakdown.map(a => {
              const p = allocation.total > 0 ? Math.round((a.amountAllocated / allocation.total) * 100) : 0
              return (
                <div key={a.programArea} className="rp-alloc-row">
                  <span className="rp-alloc-label">{a.programArea}</span>
                  <div className="rp-bar-track">
                    <div className="rp-bar-fill" style={{ width: `${p}%`, background: 'var(--cove-tidal)' }} />
                  </div>
                  <span className="rp-alloc-pct">{p}%</span>
                  <span className="rp-alloc-amt">{fmtAmt(a.amountAllocated, 'PHP')}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <LapseRiskPanel donations={donations} currency={currency} onRowsChange={onLapseRowsChange} />

      <div className="rp-section">
        <h3 className="rp-section-title">Funding Thresholds</h3>
        <div className="rp-threshold-list">
          {[
            { label: 'Essential Operations',  target: 11_000, desc: 'Minimum to keep doors open monthly' },
            { label: 'Full Program Capacity', target: 25_000, desc: 'All programs fully staffed & funded' },
            { label: 'New Shelter Expansion', target: 100_000, desc: 'Capital goal — 18 additional beds' },
          ].map(t => {
            const p = Math.min(100, Math.round((ytd / t.target) * 100))
            return (
              <div key={t.label} className="rp-threshold-row">
                <div className="rp-threshold-meta">
                  <span className="rp-threshold-label">{t.label}</span>
                  <span className="rp-threshold-desc">{t.desc}</span>
                  <span className="rp-threshold-pct">{p}% — {fmtAmt(ytd, currency)} of {fmtAmt(t.target, 'USD')}</span>
                </div>
                <div className="rp-bar-track">
                  <div className="rp-bar-fill" style={{ width: `${p}%`, background: p >= 100 ? 'var(--color-success)' : 'var(--cove-tidal)' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Resident Risk Predictor ──────────────────────────────────────────────────

const RISK_FINDINGS = [
  { icon: '📅', title: 'Days in Care is the #1 driver', body: 'Longer time in care strongly predicts risk level — complex cases take longer to resolve.' },
  { icon: '📋', title: 'Session quality matters more than quantity', body: '% of sessions with concerns flagged and progress noted outweigh total session count.' },
  { icon: '❤️', title: 'Health trends signal escalation', body: 'A declining health trend slope is a leading indicator of elevated risk — watch for drops.' },
  { icon: '🏠', title: 'Unresolved incidents are a red flag', body: 'Unresolved incidents are a stronger predictor than total incident count alone.' },
  { icon: '🎓', title: 'Attendance predicts stability', body: 'Higher education attendance rates correlate with lower risk and better reintegration outcomes.' },
  { icon: '👁️', title: 'Safety concerns during home visits', body: '% of home visits with safety concerns noted is among the top 5 risk predictors.' },
]

function riskFeatureName(name: string): string {
  const map: Record<string, string> = {
    days_in_care: 'Days in Care',
    initial_risk_level_enc: 'Initial Risk Level',
    total_sessions: 'Total Sessions',
    pct_concerns_flagged: '% Concerns Flagged',
    pct_progress_noted: '% Progress Noted',
    pct_referral_made: '% Referrals Made',
    emotional_improvement_rate: 'Emotional Improvement Rate',
    avg_general_health_score: 'Avg Health Score',
    avg_sleep_quality_score: 'Avg Sleep Quality',
    health_trend_slope: 'Health Trend',
    avg_attendance_rate: 'Avg Attendance Rate',
    total_incidents: 'Total Incidents',
    unresolved_incidents: 'Unresolved Incidents',
    total_home_visits: 'Total Home Visits',
    pct_visits_safety_concerns: '% Visits w/ Safety Concerns',
  }
  return map[name] ?? name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function riskLevelEnc(level: string | null): number {
  const map: Record<string, number> = { Low: 0, Medium: 1, High: 2, Critical: 3 }
  return map[level ?? ''] ?? 1
}

// ── Emotional state ordinal encoding (matches training pipeline) ──────────────
const EMOTIONAL_ENC: Record<string, number> = {
  'very poor': 1, 'very bad': 1, 'critical': 1,
  'poor': 2, 'bad': 2, 'low': 2, 'sad': 2, 'depressed': 2, 'distressed': 2, 'anxious': 2,
  'fair': 3, 'moderate': 3, 'neutral': 3, 'okay': 3, 'ok': 3, 'mixed': 3,
  'good': 4, 'stable': 4, 'positive': 4, 'calm': 4, 'improving': 4, 'hopeful': 4,
  'very good': 5, 'excellent': 5, 'great': 5, 'happy': 5, 'thriving': 5,
}
function encodeEmotional(state: string | null): number {
  if (!state) return 3
  return EMOTIONAL_ENC[state.toLowerCase().trim()] ?? 3
}

// ── Simple linear regression slope ────────────────────────────────────────────
function linearSlope(values: number[]): number {
  const n = values.length
  if (n < 2) return 0
  const sumX = (n * (n - 1)) / 2
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6
  const sumY = values.reduce((a, b) => a + b, 0)
  const sumXY = values.reduce((s, y, i) => s + i * y, 0)
  const denom = n * sumX2 - sumX * sumX
  return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom
}

function ResidentRiskPredictor({
  residents,
}: {
  residents: Resident[]
}) {
  const activeResidents = residents.filter(r => !r.dateClosed)

  // ── Resident selector ──
  const [selectedId,   setSelectedId]   = useState<number | ''>('')
  const [dataLoading,  setDataLoading]  = useState(false)
  const [recordSummary, setRecordSummary] = useState<string | null>(null)

  // ── All 15 ML features as sliders ──
  const [daysInCare,           setDaysInCare]           = useState(90)
  const [initialRiskEnc,       setInitialRiskEnc]       = useState(1)
  const [totalSessions,        setTotalSessions]        = useState(0)
  const [pctConcerns,          setPctConcerns]          = useState(0.0)
  const [pctProgress,          setPctProgress]          = useState(0.0)
  const [pctReferral,          setPctReferral]          = useState(0.0)
  const [emotionalImprovement, setEmotionalImprovement] = useState(0.0)
  const [avgHealthScore,       setAvgHealthScore]       = useState(3.0)
  const [avgSleepQuality,      setAvgSleepQuality]      = useState(3.0)
  const [healthTrendSlope,     setHealthTrendSlope]     = useState(0.0)
  const [avgAttendance,        setAvgAttendance]        = useState(0.0)
  const [totalIncidents,       setTotalIncidents]       = useState(0)
  const [unresolvedIncidents,  setUnresolvedIncidents]  = useState(0)
  const [totalHomeVisits,      setTotalHomeVisits]      = useState(0)
  const [pctVisitsSafety,      setPctVisitsSafety]      = useState(0.0)

  // ── Result & feature importance ──
  const [result,   setResult]   = useState<{ is_high_risk: boolean; probability: number } | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [features, setFeatures] = useState<FeatureImportance[]>([])

  useEffect(() => {
    fetchResidentRiskFeatureImportance()
      .then(f => setFeatures(f.slice(0, 10)))
      .catch(() => {})
  }, [])

  // When a resident is selected, fetch all case records and compute every feature
  useEffect(() => {
    if (selectedId === '') return
    const r = activeResidents.find(x => x.residentId === selectedId)
    if (!r) return

    setDataLoading(true)
    setResult(null)
    setRecordSummary(null)

    // Days in care & initial risk — available immediately from resident record
    if (r.dateOfAdmission) {
      const days = Math.floor((Date.now() - new Date(r.dateOfAdmission).getTime()) / 86_400_000)
      setDaysInCare(Math.max(0, days))
    }
    setInitialRiskEnc(riskLevelEnc(r.currentRiskLevel))

    // Fetch all 5 case data sources in parallel
    Promise.all([
      api.getProcessRecordingsByResident(selectedId as number).catch(() => [] as ProcessRecording[]),
      api.getHealthRecordsByResident(selectedId as number).catch(() => [] as HealthRecord[]),
      api.getHomeVisitationsByResident(selectedId as number).catch(() => [] as HomeVisitation[]),
      api.getEducationRecordsByResident(selectedId as number).catch(() => [] as EducationRecord[]),
      api.getIncidentsByResident(selectedId as number).catch(() => []),
    ]).then(([sessions, healthRecs, homeVisits, eduRecs, incidents]) => {

      // ── Session features ──
      const n = sessions.length
      setTotalSessions(n)
      if (n > 0) {
        setPctConcerns(sessions.filter(s => s.concernsFlagged).length / n)
        setPctProgress(sessions.filter(s => s.progressNoted).length / n)
        setPctReferral(sessions.filter(s => s.referralMade).length / n)
        const improved = sessions.filter(s =>
          encodeEmotional(s.emotionalStateEnd) > encodeEmotional(s.emotionalStateObserved)
        ).length
        setEmotionalImprovement(improved / n)
      }

      // ── Health features ──
      const healthScores = healthRecs
        .filter(h => h.generalHealthScore != null)
        .sort((a, b) => new Date(a.recordDate ?? 0).getTime() - new Date(b.recordDate ?? 0).getTime())
        .map(h => Number(h.generalHealthScore))
      if (healthScores.length > 0) {
        setAvgHealthScore(healthScores.reduce((a, b) => a + b, 0) / healthScores.length)
        setHealthTrendSlope(parseFloat(linearSlope(healthScores).toFixed(3)))
      }
      const sleepScores = healthRecs.filter(h => h.sleepQualityScore != null).map(h => Number(h.sleepQualityScore))
      if (sleepScores.length > 0) {
        setAvgSleepQuality(sleepScores.reduce((a, b) => a + b, 0) / sleepScores.length)
      }

      // ── Education features ──
      const attendRates = eduRecs.filter(e => e.attendanceRate != null).map(e => Number(e.attendanceRate))
      if (attendRates.length > 0) {
        setAvgAttendance(attendRates.reduce((a, b) => a + b, 0) / attendRates.length)
      }

      // ── Incident features ──
      setTotalIncidents(incidents.length)
      setUnresolvedIncidents(incidents.filter(i => i.resolved === false).length)

      // ── Home visit features ──
      setTotalHomeVisits(homeVisits.length)
      if (homeVisits.length > 0) {
        setPctVisitsSafety(homeVisits.filter(v => v.safetyConcernsNoted).length / homeVisits.length)
      }

      setRecordSummary(
        `Loaded from ${n} sessions · ${healthRecs.length} health records · ` +
        `${eduRecs.length} edu records · ${incidents.length} incidents · ${homeVisits.length} home visits`
      )
      setDataLoading(false)
    })
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function runPrediction() {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const input: ResidentRiskInput = {
        days_in_care:             daysInCare,
        initial_risk_level_enc:   initialRiskEnc,
        total_sessions:           totalSessions,
        pct_concerns_flagged:     pctConcerns,
        pct_progress_noted:       pctProgress,
        pct_referral_made:        pctReferral,
        emotional_improvement_rate: emotionalImprovement,
        avg_general_health_score: avgHealthScore,
        avg_sleep_quality_score:  avgSleepQuality,
        health_trend_slope:       healthTrendSlope,
        avg_attendance_rate:      avgAttendance,
        total_incidents:          totalIncidents,
        unresolved_incidents:     unresolvedIncidents,
        total_home_visits:        totalHomeVisits,
        pct_visits_safety_concerns: pctVisitsSafety,
      }
      const res = await predictResidentRisk(input)
      setResult(res)
    } catch {
      setError('ML API unavailable — make sure the prediction service is running.')
    } finally {
      setLoading(false)
    }
  }

  const pct = result ? Math.round(result.probability * 100) : 0
  const maxImportance = features[0]?.importance ?? 1

  const selectedResident = activeResidents.find(r => r.residentId === selectedId)

  return (
    <div className="rp-section">
      <h3 className="rp-section-title">ML Resident Risk Predictor</h3>
      <p className="rp-section-sub">
        Select a resident to auto-populate their data, then adjust the sliders and run the model to get
        a risk prediction from the ML classifier trained on Lighthouse case history.
      </p>

      <div className="rrp-layout">
        {/* ── Left: form ── */}
        <div className="rrp-form-col">

          {/* Resident selector */}
          <div className="rrp-form-section">
            <div className="rrp-section-label">Select Resident</div>
            <select
              className="rrp-select"
              value={selectedId}
              onChange={e => setSelectedId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">— or fill in manually below —</option>
              {activeResidents.map(r => (
                <option key={r.residentId} value={r.residentId}>
                  {r.internalCode ?? r.caseControlNo ?? `Resident #${r.residentId}`}
                  {r.currentRiskLevel ? ` · ${r.currentRiskLevel} Risk` : ''}
                </option>
              ))}
            </select>
            {dataLoading && <p className="rrp-loading">Loading case records…</p>}
            {selectedResident && !dataLoading && (
              <div className="rrp-auto-pills">
                <span className="rrp-auto-pill">📅 {daysInCare} days in care</span>
                <span className="rrp-auto-pill">⚠️ {['Low','Medium','High','Critical'][initialRiskEnc]} initial risk</span>
                {recordSummary && <span className="rrp-auto-pill rrp-auto-filled">✓ {recordSummary}</span>}
              </div>
            )}
          </div>

          {/* Case activity */}
          <div className="rrp-form-section">
            <div className="rrp-section-label">Case Activity</div>
            <div className="rrp-slider-grid">
              <SliderField label="Total Sessions" value={totalSessions} min={0} max={60} step={1}
                display={String(totalSessions)} onChange={setTotalSessions} />
              <SliderField label="% Concerns Flagged" value={pctConcerns} min={0} max={1} step={0.05}
                display={`${Math.round(pctConcerns * 100)}%`} onChange={setPctConcerns} />
              <SliderField label="% Progress Noted" value={pctProgress} min={0} max={1} step={0.05}
                display={`${Math.round(pctProgress * 100)}%`} onChange={setPctProgress} />
              <SliderField label="% Referrals Made" value={pctReferral} min={0} max={1} step={0.05}
                display={`${Math.round(pctReferral * 100)}%`} onChange={setPctReferral} />
              <SliderField label="Emotional Improvement Rate" value={emotionalImprovement} min={0} max={1} step={0.05}
                display={`${Math.round(emotionalImprovement * 100)}%`} onChange={setEmotionalImprovement} />
            </div>
          </div>

          {/* Health */}
          <div className="rrp-form-section">
            <div className="rrp-section-label">
              Health & Wellbeing
              {recordSummary && <span className="rrp-auto-badge">from records</span>}
            </div>
            <div className="rrp-slider-grid">
              <SliderField label="Avg Health Score (/ 5)" value={avgHealthScore} min={1} max={5} step={0.1}
                display={avgHealthScore.toFixed(1)} onChange={setAvgHealthScore} />
              <SliderField label="Avg Sleep Quality (/ 5)" value={avgSleepQuality} min={1} max={5} step={0.1}
                display={avgSleepQuality.toFixed(1)} onChange={setAvgSleepQuality} />
              <SliderField label="Health Trend" value={healthTrendSlope} min={-1} max={1} step={0.05}
                display={healthTrendSlope > 0 ? `+${healthTrendSlope.toFixed(2)}` : healthTrendSlope.toFixed(2)}
                onChange={setHealthTrendSlope} />
            </div>
          </div>

          {/* Education */}
          <div className="rrp-form-section">
            <div className="rrp-section-label">
              Education
              {recordSummary && <span className="rrp-auto-badge">from records</span>}
            </div>
            <div className="rrp-slider-grid">
              <SliderField label="Avg Attendance Rate" value={avgAttendance} min={0} max={1} step={0.05}
                display={`${Math.round(avgAttendance * 100)}%`} onChange={setAvgAttendance} />
            </div>
          </div>

          {/* Incidents & visits */}
          <div className="rrp-form-section">
            <div className="rrp-section-label">Incidents & Home Visits</div>
            <div className="rrp-slider-grid">
              <SliderField label="Total Incidents" value={totalIncidents} min={0} max={20} step={1}
                display={String(totalIncidents)} onChange={setTotalIncidents} />
              <SliderField label="Unresolved Incidents" value={unresolvedIncidents} min={0} max={totalIncidents} step={1}
                display={String(unresolvedIncidents)} onChange={v => setUnresolvedIncidents(Math.min(v, totalIncidents))} />
              <SliderField label="Total Home Visits" value={totalHomeVisits} min={0} max={30} step={1}
                display={String(totalHomeVisits)} onChange={setTotalHomeVisits} />
              <SliderField label="% Visits w/ Safety Concerns" value={pctVisitsSafety} min={0} max={1} step={0.05}
                display={`${Math.round(pctVisitsSafety * 100)}%`} onChange={setPctVisitsSafety} />
            </div>
          </div>

          <div className="rrp-footer">
            <button className="rrp-predict-btn" onClick={runPrediction} disabled={loading}>
              {loading ? 'Predicting…' : 'Predict Risk Level'}
            </button>
            {error && <p className="rrp-error">{error}</p>}
          </div>
        </div>

        {/* ── Right: result + feature importance ── */}
        <div className="rrp-result-col">
          {result ? (
            <div className={`rrp-result-card ${result.is_high_risk ? 'rrp-high' : 'rrp-low'}`}>
              <div className="rrp-result-pct">{pct}%</div>
              <div className="rrp-result-label">{result.is_high_risk ? 'High Risk' : 'Lower Risk'}</div>
              <div className="rrp-result-track">
                <div className="rrp-result-fill" style={{
                  width: `${pct}%`,
                  background: result.is_high_risk ? 'var(--color-error)' : 'var(--color-success)',
                }} />
              </div>
              <p className="rrp-result-note">
                {result.is_high_risk
                  ? 'This resident profile indicates elevated risk. Review case activity and consider immediate intervention planning.'
                  : 'This resident profile is within expected range. Continue standard monitoring and support.'}
              </p>
            </div>
          ) : (
            <div className="rrp-result-placeholder">
              <span className="rrp-placeholder-icon">🔍</span>
              <p>Fill in the resident's details and click <strong>Predict Risk Level</strong> to see the model's assessment.</p>
            </div>
          )}

          {/* Feature importance */}
          {features.length > 0 && (
            <div className="rrp-feat-card">
              <div className="rrp-feat-title">What Drives Risk Predictions</div>
              <div className="rrp-feat-list">
                {features.map((f, i) => (
                  <div key={f.feature} className="rrp-feat-row">
                    <span className="rrp-feat-rank">#{i + 1}</span>
                    <span className="rrp-feat-label">{riskFeatureName(f.feature)}</span>
                    <div className="rrp-feat-track">
                      <div className="rrp-feat-bar" style={{ width: `${(f.importance / maxImportance) * 100}%` }} />
                    </div>
                    <span className="rrp-feat-pct">{Math.round(f.importance * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Key findings */}
      <div className="rrp-findings-grid">
        {RISK_FINDINGS.map(f => (
          <div key={f.title} className="rrp-finding">
            <span className="rrp-finding-icon">{f.icon}</span>
            <div>
              <div className="rrp-finding-title">{f.title}</div>
              <div className="rrp-finding-body">{f.body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Small reusable slider field ───────────────────────────────────────────────

function SliderField({
  label, value, min, max, step, display, onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (v: number) => void
}) {
  return (
    <div className="rrp-slider-field">
      <div className="rrp-slider-header">
        <span className="rrp-slider-label">{label}</span>
        <span className="rrp-slider-val">{display}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="rrp-range"
      />
    </div>
  )
}

// ─── Tab: Resident Outcomes ────────────────────────────────────────────────────

function OutcomesTab({
  metrics, safehouses, residents, loading,
}: {
  metrics: SafehouseMonthlyMetric[]
  safehouses: Safehouse[]
  residents: Resident[]
  loading: boolean
}) {
  const activeResidents = residents.filter(r => !r.dateClosed)
  const reintegrated = residents.filter(r => r.reintegrationStatus && r.reintegrationStatus !== 'Not Started')
  const highRisk = residents.filter(r => r.currentRiskLevel === 'High' || r.currentRiskLevel === 'Critical')

  // ── ML: Resident risk predictions ───────────────────────────────────────────
  type RiskRow = {
    resident: Resident
    features: ResidentMlFeatures
    probability: number
    isHighRisk: boolean
  }
  const [riskPreds, setRiskPreds] = useState<RiskRow[]>([])
  const [riskLoading, setRiskLoading] = useState(false)
  const [riskError, setRiskError] = useState<string | null>(null)

  useEffect(() => {
    if (activeResidents.length === 0) return
    let cancelled = false
    setRiskLoading(true)
    setRiskError(null)

    const activeIds = new Set(activeResidents.map(r => r.residentId))

    api.getResidentMlFeatures()
      .then(async (allFeatures: ResidentMlFeatures[]) => {
        const features = allFeatures.filter(f => activeIds.has(f.resident_id))
        const residentById = new Map(activeResidents.map(r => [r.residentId, r]))

        return Promise.all(
          features.map(async (f) => {
            // Strip metadata fields; forward only the model's input columns.
            const {
              resident_id: _id,
              internal_code: _ic,
              case_control_no: _cc,
              current_risk_level: _crl,
              assigned_social_worker: _sw,
              last_action_date: _lad,
              last_action_type: _lat,
              ...input
            } = f
            void _id; void _ic; void _cc; void _crl; void _sw; void _lad; void _lat
            try {
              const res = await predictResidentRisk(input as unknown as ResidentRiskInput)
              return {
                resident: residentById.get(f.resident_id)!,
                features: f,
                probability: res.probability,
                isHighRisk: res.is_high_risk,
              }
            } catch {
              return {
                resident: residentById.get(f.resident_id)!,
                features: f,
                probability: 0,
                isHighRisk: false,
              }
            }
          }),
        )
      })
      .then((results) => {
        if (cancelled) return
        results.sort((a, b) => b.probability - a.probability)
        setRiskPreds(results)
      })
      .catch((err) => {
        if (!cancelled) setRiskError(err instanceof Error ? err.message : 'Prediction failed')
      })
      .finally(() => {
        if (!cancelled) setRiskLoading(false)
      })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [residents.length])

  const modelHighRiskCount = riskPreds.filter(p => p.isHighRisk).length

  // ── ML: Education outcome predictions ──────────────────────────────────────
  type EduRow = { resident: Resident; probability: number; willComplete: boolean }
  const [eduPreds, setEduPreds] = useState<EduRow[]>([])
  const [eduLoading, setEduLoading] = useState(false)
  const [eduError, setEduError] = useState<string | null>(null)

  useEffect(() => {
    if (activeResidents.length === 0) return
    let cancelled = false
    setEduLoading(true)
    setEduError(null)

    api.getEducationRecords()
      .then(async (allRecords) => {
        // Group records by resident, sorted earliest first
        const byResident = new Map<number, typeof allRecords>()
        allRecords.forEach(r => {
          if (r.residentId == null) return
          const arr = byResident.get(r.residentId) ?? []
          arr.push(r)
          byResident.set(r.residentId, arr)
        })
        byResident.forEach((recs, id) =>
          byResident.set(id, recs.sort((a, b) =>
            new Date(a.recordDate ?? 0).getTime() - new Date(b.recordDate ?? 0).getTime()
          ))
        )

        const residentById = new Map(activeResidents.map(r => [r.residentId, r]))
        const rows = await Promise.all(
          activeResidents
            .filter(r => (byResident.get(r.residentId)?.length ?? 0) > 0)
            .map(async (r) => {
              const recs = (byResident.get(r.residentId) ?? []).slice(0, 3)
              const attRates = recs.map(rec => rec.attendanceRate ?? 0.8)
              const progPcts  = recs.map(rec => (rec.progressPercent ?? 50) / 100)
              const early_attendance_mean = attRates.reduce((s, v) => s + v, 0) / attRates.length
              const early_progress_mean   = progPcts.reduce((s, v) => s + v, 0) / progPcts.length
              const initial_progress      = progPcts[0]
              const early_attendance_slope = attRates.length >= 2
                ? (attRates[attRates.length - 1] - attRates[0]) / (attRates.length - 1)
                : 0
              const input: EducationOutcomeInput = {
                early_health_mean: 3.5,               // approximated — health records fetched separately
                early_attendance_mean,
                early_progress_mean,
                early_emotional_improvement_rate: 0.5, // approximated — process recordings fetched separately
                early_attendance_slope,
                initial_progress,
              }
              try {
                const res = await predictEducationOutcome(input)
                return { resident: residentById.get(r.residentId)!, probability: res.probability, willComplete: res.will_complete }
              } catch {
                return { resident: residentById.get(r.residentId)!, probability: 0.5, willComplete: false }
              }
            })
        )
        return rows.sort((a, b) => b.probability - a.probability)
      })
      .then(rows => { if (!cancelled) setEduPreds(rows) })
      .catch(err => { if (!cancelled) setEduError(err instanceof Error ? err.message : 'Prediction failed') })
      .finally(() => { if (!cancelled) setEduLoading(false) })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [residents.length])

  const eduCompleteCount = eduPreds.filter(p => p.willComplete).length

  // ── Filters ────────────────────────────────────────────────────────────────
  const [filterSafehouse, setFilterSafehouse] = useState<string>('all')
  const [filterSw, setFilterSw] = useState<string>('all')
  const [filterCurrentRisk, setFilterCurrentRisk] = useState<string>('all')
  const [showOnlyDisagreements, setShowOnlyDisagreements] = useState(false)

  const swOptions = useMemo(() => {
    const set = new Set<string>()
    riskPreds.forEach(p => {
      const sw = p.features.assigned_social_worker
      if (sw) set.add(sw)
    })
    return Array.from(set).sort()
  }, [riskPreds])

  const safehouseOptions = useMemo(() => {
    const set = new Set<string>()
    safehouses.forEach(sh => {
      const code = sh.safehouseCode ?? sh.name ?? `SH${sh.safehouseId}`
      set.add(code)
    })
    return Array.from(set).sort()
  }, [safehouses])

  const safehouseCodeById = useMemo(() => {
    const m = new Map<number, string>()
    safehouses.forEach(sh => {
      m.set(sh.safehouseId, sh.safehouseCode ?? sh.name ?? `SH${sh.safehouseId}`)
    })
    return m
  }, [safehouses])

  const filteredRiskPreds = useMemo(() => {
    return riskPreds.filter(p => {
      if (filterSafehouse !== 'all') {
        const code = safehouseCodeById.get(p.features.safehouse_id) ?? ''
        if (code !== filterSafehouse) return false
      }
      if (filterSw !== 'all' && p.features.assigned_social_worker !== filterSw) return false
      if (filterCurrentRisk !== 'all' && (p.resident.currentRiskLevel ?? 'Unknown') !== filterCurrentRisk) {
        return false
      }
      if (showOnlyDisagreements) {
        const swSaysHigh = p.resident.currentRiskLevel === 'High' || p.resident.currentRiskLevel === 'Critical'
        if (swSaysHigh === p.isHighRisk) return false
      }
      return true
    })
  }, [riskPreds, filterSafehouse, filterSw, filterCurrentRisk, showOnlyDisagreements, safehouseCodeById])

  const [riskPage, setRiskPage] = useState(1)
  const RISK_PAGE_SIZE = 10
  const riskPageCount = Math.max(1, Math.ceil(filteredRiskPreds.length / RISK_PAGE_SIZE))
  const riskPageItems = filteredRiskPreds.slice(
    (riskPage - 1) * RISK_PAGE_SIZE,
    riskPage * RISK_PAGE_SIZE,
  )
  useEffect(() => { setRiskPage(1) }, [filteredRiskPreds.length])

  // ── "Why" expansion ────────────────────────────────────────────────────────
  // For each resident, compare their values for the model's selected features
  // against the cohort median. Surface the features where this resident is
  // notably worse than typical — those drove the high score.
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // Selected features from resident_risk_metadata.json + display labels and direction.
  // direction: 'higher' = higher value = more risk; 'lower' = lower value = more risk.
  const SELECTED_FEATURES: { key: keyof ResidentMlFeatures; label: string; direction: 'higher' | 'lower' }[] = [
    { key: 'days_in_care',                label: 'Days in care',                  direction: 'higher' },
    { key: 'initial_risk_level_enc',      label: 'Initial risk level',            direction: 'higher' },
    { key: 'total_sessions',              label: 'Total counseling sessions',     direction: 'lower'  },
    { key: 'pct_concerns_flagged',        label: '% sessions w/ concerns',        direction: 'higher' },
    { key: 'pct_progress_noted',          label: '% sessions w/ progress',        direction: 'lower'  },
    { key: 'pct_referral_made',           label: '% sessions w/ referral',        direction: 'higher' },
    { key: 'emotional_improvement_rate',  label: 'Emotional improvement rate',    direction: 'lower'  },
    { key: 'avg_general_health_score',    label: 'Avg general health',            direction: 'lower'  },
    { key: 'avg_sleep_quality_score',     label: 'Avg sleep quality',             direction: 'lower'  },
    { key: 'health_trend_slope',          label: 'Health trend (slope)',          direction: 'lower'  },
    { key: 'avg_attendance_rate',         label: 'Avg attendance rate',           direction: 'lower'  },
    { key: 'total_incidents',             label: 'Total incidents',               direction: 'higher' },
    { key: 'unresolved_incidents',        label: 'Unresolved incidents',          direction: 'higher' },
    { key: 'total_home_visits',           label: 'Total home visits',             direction: 'lower'  },
    { key: 'pct_visits_safety_concerns',  label: '% visits w/ safety concerns',   direction: 'higher' },
  ]

  const cohortMedians = useMemo(() => {
    const out: Record<string, number> = {}
    if (riskPreds.length === 0) return out
    SELECTED_FEATURES.forEach(({ key }) => {
      const values = riskPreds
        .map(p => Number(p.features[key] ?? 0))
        .filter(n => Number.isFinite(n))
        .sort((a, b) => a - b)
      const mid = Math.floor(values.length / 2)
      out[key as string] = values.length === 0
        ? 0
        : values.length % 2 === 0
          ? (values[mid - 1] + values[mid]) / 2
          : values[mid]
    })
    return out
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riskPreds])

  function topReasons(features: ResidentMlFeatures): { label: string; value: number; median: number; worse: boolean }[] {
    return SELECTED_FEATURES
      .map(({ key, label, direction }) => {
        const value = Number(features[key] ?? 0)
        const median = cohortMedians[key as string] ?? 0
        const worse = direction === 'higher' ? value > median : value < median
        // Score = signed gap from median, normalized so larger = "more anomalous in the bad direction"
        const gap = direction === 'higher' ? value - median : median - value
        return { label, value, median, worse, gap }
      })
      .filter(r => r.worse && r.gap > 0)
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 5)
      .map(({ label, value, median, worse }) => ({ label, value, median, worse }))
  }

  function fmt(n: number): string {
    if (!Number.isFinite(n)) return '—'
    if (Math.abs(n) >= 10) return n.toFixed(0)
    if (Math.abs(n) >= 1) return n.toFixed(1)
    return n.toFixed(2)
  }

  function daysSince(iso: string | null): string {
    if (!iso) return '—'
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
    if (days === 0) return 'today'
    if (days === 1) return '1 day ago'
    return `${days} days ago`
  }

  const avgHealth = metrics.length
    ? metrics.reduce((s, m) => s + (m.avgHealthScore ?? 0), 0) / metrics.filter(m => m.avgHealthScore != null).length
    : 0
  const avgEdu = metrics.length
    ? metrics.reduce((s, m) => s + (m.avgEducationProgress ?? 0), 0) / metrics.filter(m => m.avgEducationProgress != null).length
    : 0

  // Health score distribution per safehouse
  const shHealth = safehouses.map(sh => {
    const m = metrics.find(x => x.safehouseId === sh.safehouseId)
    return {
      label: sh.safehouseCode ?? sh.name ?? `SH${sh.safehouseId}`,
      count: m?.activeResidents ?? sh.currentOccupancy ?? 0,
      health: m?.avgHealthScore != null ? Number(m.avgHealthScore) : null,
      edu: m?.avgEducationProgress != null ? Number(m.avgEducationProgress) : null,
      incidents: m?.incidentCount ?? 0,
    }
  }).filter(s => s.count > 0)

  return (
    <div className="rp-tab-content">
      <div className="rp-kpi-grid">
        {[
          { label: 'Active Residents', value: String(activeResidents.length), sub: 'currently in care' },
          { label: 'Avg. Health Score', value: avgHealth ? `${avgHealth.toFixed(1)} / 5` : '—', sub: 'across all safehouses' },
          { label: 'Avg. Education Progress', value: avgEdu ? `${Math.round(avgEdu)}%` : '—', sub: 'across all safehouses' },
          { label: 'Reintegration Pipeline', value: String(reintegrated.length), sub: `${highRisk.length} high-risk residents` },
          { label: 'ML-Flagged High Risk', value: riskLoading ? '…' : String(modelHighRiskCount), sub: 'predicted by resident risk model' },
          { label: 'ML: Predicted to Complete Edu.', value: eduLoading ? '…' : String(eduCompleteCount), sub: `of ${eduPreds.length} scored residents` },
        ].map(k => (
          <div key={k.label} className="rp-kpi">
            <div className="rp-kpi-label">{k.label}</div>
            <div className="rp-kpi-value">{k.value}</div>
            <div className="rp-kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {loading ? <p className="rp-empty">Loading…</p> : (
        <>
          <div className="rp-section">
            <h3 className="rp-section-title">Health & Education by Safehouse</h3>
            <table className="rp-table rp-table-wide">
              <thead>
                <tr>
                  <th>Safehouse</th>
                  <th>Residents</th>
                  <th>Avg Health (/ 5)</th>
                  <th>Health Bar</th>
                  <th>Edu Progress</th>
                  <th>Edu Bar</th>
                  <th>Incidents</th>
                </tr>
              </thead>
              <tbody>
                {shHealth.map(s => (
                  <tr key={s.label}>
                    <td className="rp-td-name">{s.label}</td>
                    <td className="rp-td-num">{s.count}</td>
                    <td className="rp-td-num">{s.health != null ? s.health.toFixed(1) : '—'}</td>
                    <td>
                      {s.health != null ? (
                        <div className="rp-mini-track">
                          <div className="rp-mini-fill" style={{
                            width: `${(s.health / 5) * 100}%`,
                            background: s.health >= 4 ? 'var(--color-success)' : s.health >= 2.5 ? 'var(--cove-tidal)' : 'var(--color-warning)',
                          }} />
                        </div>
                      ) : '—'}
                    </td>
                    <td className="rp-td-num">{s.edu != null ? `${Math.round(s.edu)}%` : '—'}</td>
                    <td>
                      {s.edu != null ? (
                        <div className="rp-mini-track">
                          <div className="rp-mini-fill" style={{
                            width: `${s.edu}%`,
                            background: s.edu >= 75 ? 'var(--color-success)' : s.edu >= 40 ? 'var(--cove-seaglass)' : 'var(--color-warning)',
                          }} />
                        </div>
                      ) : '—'}
                    </td>
                    <td className="rp-td-num" style={{ color: s.incidents > 0 ? 'var(--color-warning)' : 'inherit' }}>
                      {s.incidents}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rp-section">
            <h3 className="rp-section-title">
              ML Risk Predictions — Residents to Prioritize
            </h3>
            <p className="rp-empty" style={{ marginTop: 0 }}>
              Ranked by the resident risk model's predicted probability of High/Critical status.
              Use as a triage hint, not a verdict — social workers should still review every case.
            </p>
            {riskError && <p className="rp-empty" style={{ color: 'var(--color-warning)' }}>{riskError}</p>}

            {/* Filters */}
            {!riskLoading && riskPreds.length > 0 && (
              <div className="rp-ml-toolbar">
                <select
                  className="rp-ml-pill"
                  value={filterSafehouse}
                  onChange={(e) => setFilterSafehouse(e.target.value)}
                >
                  <option value="all">All Safehouses</option>
                  {safehouseOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                  className="rp-ml-pill"
                  value={filterSw}
                  onChange={(e) => setFilterSw(e.target.value)}
                >
                  <option value="all">All Social Workers</option>
                  {swOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                  className="rp-ml-pill"
                  value={filterCurrentRisk}
                  onChange={(e) => setFilterCurrentRisk(e.target.value)}
                >
                  <option value="all">All Risk Levels</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
                <label className={`rp-ml-toggle${showOnlyDisagreements ? ' rp-ml-toggle--on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={showOnlyDisagreements}
                    onChange={(e) => setShowOnlyDisagreements(e.target.checked)}
                  />
                  Disagreements only
                </label>
                <span className="rp-ml-count">
                  {filteredRiskPreds.length} of {riskPreds.length} residents
                </span>
              </div>
            )}

            {riskLoading ? (
              <p className="rp-empty">Scoring residents…</p>
            ) : riskPreds.length === 0 ? (
              <p className="rp-empty">No active residents to score.</p>
            ) : filteredRiskPreds.length === 0 ? (
              <p className="rp-empty">No residents match the current filters.</p>
            ) : (
              <table className="rp-table rp-table-wide">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Resident</th>
                    <th>Safehouse</th>
                    <th>Social Worker</th>
                    <th>Current Risk</th>
                    <th>Predicted</th>
                    <th>Risk Bar</th>
                    <th>ML Flag</th>
                    <th>Last Action</th>
                    <th>Why</th>
                  </tr>
                </thead>
                <tbody>
                  {riskPageItems.map((p, idx) => {
                    const i = (riskPage - 1) * RISK_PAGE_SIZE + idx
                    const pct = Math.round(p.probability * 100)
                    const color = p.probability >= 0.75
                      ? 'var(--color-warning)'
                      : p.probability >= 0.5
                        ? 'var(--cove-tidal)'
                        : 'var(--cove-seaglass)'
                    const swSaysHigh = p.resident.currentRiskLevel === 'High' || p.resident.currentRiskLevel === 'Critical'
                    const disagrees = swSaysHigh !== p.isHighRisk
                    const isExpanded = expandedId === p.resident.residentId
                    const reasons = isExpanded ? topReasons(p.features) : []
                    const safehouseCode = safehouseCodeById.get(p.features.safehouse_id) ?? '—'
                    return (
                      <Fragment key={p.resident.residentId}>
                        <tr>
                          <td className="rp-td-num">{i + 1}</td>
                          <td className="rp-td-name">
                            <Link
                              className="rp-ml-link"
                              to={`/admin/residents/${p.resident.residentId}`}
                            >
                              {p.resident.internalCode ?? p.resident.caseControlNo ?? `#${p.resident.residentId}`}
                            </Link>
                          </td>
                          <td>{safehouseCode}</td>
                          <td>{p.features.assigned_social_worker ?? '—'}</td>
                          <td>
                            {p.resident.currentRiskLevel ?? '—'}
                            {disagrees && (
                              <span className="rp-ml-disagree" title="Model disagrees with current risk level">
                                Mismatch
                              </span>
                            )}
                          </td>
                          <td className="rp-td-num">{pct}%</td>
                          <td>
                            <div className="rp-mini-track">
                              <div className="rp-mini-fill" style={{ width: `${pct}%`, background: color }} />
                            </div>
                          </td>
                          <td>
                            <span className={`rp-ml-flag ${p.isHighRisk ? 'rp-ml-flag--high' : 'rp-ml-flag--ok'}`}>
                              {p.isHighRisk ? 'High Risk' : 'OK'}
                            </span>
                          </td>
                          <td>
                            {p.features.last_action_type ? (
                              <>
                                <div className="rp-ml-action-type">{p.features.last_action_type}</div>
                                <div className="rp-ml-action-time">{daysSince(p.features.last_action_date)}</div>
                              </>
                            ) : '—'}
                          </td>
                          <td>
                            <button
                              className="rp-ml-why-btn"
                              onClick={() => setExpandedId(isExpanded ? null : p.resident.residentId)}
                            >
                              {isExpanded ? 'Hide' : 'Why?'}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={10} className="rp-ml-why-panel">
                              <div className="rp-ml-why-title">
                                Top contributing factors (vs. cohort median)
                              </div>
                              {reasons.length === 0 ? (
                                <div className="rp-ml-why-empty">
                                  This resident is not notably worse than the cohort on any of the model's selected features.
                                </div>
                              ) : (
                                <ul className="rp-ml-why-list">
                                  {reasons.map(r => (
                                    <li key={r.label} className="rp-ml-why-row">
                                      <span className="rp-ml-why-label">{r.label}</span>
                                      <span className="rp-ml-why-values">
                                        <span className="rp-ml-why-value">{fmt(r.value)}</span>
                                        <span className="rp-ml-why-median">vs {fmt(r.median)}</span>
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            )}
            {riskPreds.length > RISK_PAGE_SIZE && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 'var(--space-sm)',
                  marginTop: 'var(--space-sm)',
                }}
              >
                <button
                  className="rp-tab-btn"
                  disabled={riskPage === 1}
                  onClick={() => setRiskPage(p => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <span style={{ fontSize: '0.875rem' }}>
                  Page {riskPage} of {riskPageCount}
                </span>
                <button
                  className="rp-tab-btn"
                  disabled={riskPage === riskPageCount}
                  onClick={() => setRiskPage(p => Math.min(riskPageCount, p + 1))}
                >
                  Next
                </button>
              </div>
            )}
          </div>

          <div className="rp-section">
            <h3 className="rp-section-title">ML Education Outcome Predictions</h3>
            <p className="rp-empty" style={{ marginTop: 0 }}>
              Predicts whether each active resident is on track to complete their education program,
              based on early attendance and progress trends. Use as a guidance tool — social workers
              should review individual case context.
            </p>
            {eduError && <p className="rp-empty" style={{ color: 'var(--color-warning)' }}>{eduError}</p>}
            {eduLoading ? (
              <p className="rp-empty">Scoring residents…</p>
            ) : eduPreds.length === 0 ? (
              <p className="rp-empty">No education records available to score.</p>
            ) : (
              <table className="rp-table rp-table-wide">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Resident</th>
                    <th>Safehouse</th>
                    <th>Completion Probability</th>
                    <th>Progress Bar</th>
                    <th>Prediction</th>
                  </tr>
                </thead>
                <tbody>
                  {eduPreds.map((p, idx) => {
                    const pct = Math.round(p.probability * 100)
                    const color = p.willComplete
                      ? 'var(--color-success)'
                      : p.probability >= 0.4
                        ? 'var(--cove-tidal)'
                        : 'var(--color-warning)'
                    const safehouseCode = safehouseCodeById.get(p.resident.safehouseId ?? -1) ?? '—'
                    return (
                      <tr key={p.resident.residentId}>
                        <td className="rp-td-num">{idx + 1}</td>
                        <td className="rp-td-name">
                          <Link
                            className="rp-ml-link"
                            to={`/admin/residents/${p.resident.residentId}`}
                          >
                            {p.resident.internalCode ?? p.resident.caseControlNo ?? `#${p.resident.residentId}`}
                          </Link>
                        </td>
                        <td>{safehouseCode}</td>
                        <td className="rp-td-num">{pct}%</td>
                        <td>
                          <div className="rp-mini-track">
                            <div className="rp-mini-fill" style={{ width: `${pct}%`, background: color }} />
                          </div>
                        </td>
                        <td>
                          <span className={`rp-ml-flag ${p.willComplete ? 'rp-ml-flag--ok' : 'rp-ml-flag--high'}`}>
                            {p.willComplete ? 'On Track' : 'Needs Support'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="rp-two-col">
            <div className="rp-card">
              <h3 className="rp-card-title">Residents by Risk Level</h3>
              <BarChart
                data={['Low', 'Medium', 'High', 'Critical'].map(lvl => ({
                  label: lvl,
                  count: residents.filter(r => r.currentRiskLevel === lvl && !r.dateClosed).length,
                }))}
                labelKey="label"
                valueKey="count"
                color="var(--cove-seaglass)"
              />
            </div>
            <div className="rp-card">
              <h3 className="rp-card-title">Reintegration Status</h3>
              <BarChart
                data={['Not Started', 'In Progress', 'Completed', 'Reintegrated'].map(s => ({
                  label: s,
                  count: residents.filter(r => (r.reintegrationStatus ?? 'Not Started') === s).length,
                }))}
                labelKey="label"
                valueKey="count"
                color="var(--cove-tidal)"
              />
            </div>
          </div>

          <ResidentRiskPredictor residents={residents} />
        </>
      )}
    </div>
  )
}

// ─── Tab: Safehouse Performance ────────────────────────────────────────────────

function SafehouseTab({
  safehouses, metrics, loading,
}: {
  safehouses: Safehouse[]
  metrics: SafehouseMonthlyMetric[]
  loading: boolean
}) {
  const active = safehouses.filter(s => s.status === 'Active')
  const totalCap = safehouses.reduce((s, h) => s + (h.capacityGirls ?? 0), 0)
  const totalOcc = safehouses.reduce((s, h) => s + (h.currentOccupancy ?? 0), 0)

  return (
    <div className="rp-tab-content">
      <div className="rp-kpi-grid">
        {[
          { label: 'Active Safehouses', value: String(active.length), sub: `of ${safehouses.length} total locations` },
          { label: 'Total Capacity', value: String(totalCap), sub: 'approved shelter beds' },
          { label: 'Current Occupancy', value: String(totalOcc), sub: `${totalCap > 0 ? Math.round((totalOcc / totalCap) * 100) : 0}% system-wide` },
          { label: 'Available Beds', value: String(totalCap - totalOcc), sub: 'open placements' },
        ].map(k => (
          <div key={k.label} className="rp-kpi">
            <div className="rp-kpi-label">{k.label}</div>
            <div className="rp-kpi-value">{k.value}</div>
            <div className="rp-kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {loading ? <p className="rp-empty">Loading…</p> : (
        <div className="rp-section">
          <h3 className="rp-section-title">Safehouse Comparison</h3>
          <table className="rp-table rp-table-wide">
            <thead>
              <tr>
                <th>Code</th>
                <th>Location</th>
                <th>Status</th>
                <th>Occupancy</th>
                <th>Capacity</th>
                <th>Fill Rate</th>
                <th>Staff Cap.</th>
                <th>Health Score</th>
                <th>Edu Progress</th>
                <th>Incidents</th>
                <th>Process Recs.</th>
                <th>Home Visits</th>
              </tr>
            </thead>
            <tbody>
              {safehouses.map(h => {
                const m = metrics.find(x => x.safehouseId === h.safehouseId)
                const occ = h.currentOccupancy ?? 0
                const cap = h.capacityGirls ?? 0
                const fillPct = cap > 0 ? Math.round((occ / cap) * 100) : 0
                return (
                  <tr key={h.safehouseId}>
                    <td className="rp-td-name">{h.safehouseCode ?? `SH${h.safehouseId}`}</td>
                    <td>{[h.city, h.region].filter(Boolean).join(', ')}</td>
                    <td>
                      <span className={`rp-badge ${h.status === 'Active' ? 'rp-badge-ok' : 'rp-badge-off'}`}>
                        {h.status ?? '—'}
                      </span>
                    </td>
                    <td className="rp-td-num">{occ}</td>
                    <td className="rp-td-num">{cap}</td>
                    <td>
                      <div className="rp-mini-track">
                        <div className="rp-mini-fill" style={{
                          width: `${fillPct}%`,
                          background: fillPct >= 100 ? 'var(--color-error)' : fillPct >= 80 ? 'var(--color-warning)' : 'var(--cove-tidal)',
                        }} />
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{fillPct}%</span>
                    </td>
                    <td className="rp-td-num">{h.capacityStaff ?? '—'}</td>
                    <td className="rp-td-num">{m?.avgHealthScore != null ? Number(m.avgHealthScore).toFixed(1) : '—'}</td>
                    <td className="rp-td-num">{m?.avgEducationProgress != null ? `${Math.round(Number(m.avgEducationProgress))}%` : '—'}</td>
                    <td className="rp-td-num" style={{ color: (m?.incidentCount ?? 0) > 0 ? 'var(--color-warning)' : 'inherit' }}>
                      {m?.incidentCount ?? 0}
                    </td>
                    <td className="rp-td-num">{m?.processRecordingCount ?? '—'}</td>
                    <td className="rp-td-num">{m?.homeVisitationCount ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Annual Accomplishment Report ────────────────────────────────────────

function AnnualTab({
  residents, metrics, donations, safehouses, loading,
}: {
  residents: Resident[]
  metrics: SafehouseMonthlyMetric[]
  donations: Donation[]
  safehouses: Safehouse[]
  loading: boolean
}) {
  const now = new Date()
  const year = now.getFullYear()

  const admittedThisYear = residents.filter(r => r.dateOfAdmission && new Date(r.dateOfAdmission).getFullYear() === year)
  const reintegratedThisYear = residents.filter(r =>
    r.reintegrationStatus === 'Reintegrated' || r.reintegrationStatus === 'Completed'
  )
  const activeNow = residents.filter(r => !r.dateClosed)
  const totalProc = metrics.reduce((s, m) => s + (m.processRecordingCount ?? 0), 0)
  const totalVisits = metrics.reduce((s, m) => s + (m.homeVisitationCount ?? 0), 0)
  const totalIncidents = metrics.reduce((s, m) => s + (m.incidentCount ?? 0), 0)
  const ytdDonations = donations.filter(d => d.donationDate && new Date(d.donationDate).getFullYear() === year)
  const ytdTotal = ytdDonations.reduce((s, d) => s + (d.amount ?? 0), 0)
  const currency = donations[0]?.currencyCode ?? 'PHP'

  const pillars: { title: string; subtitle: string; color: string; icon: ReactNode; stats: { label: string; value: string }[] }[] = [
    {
      title: 'CARING',
      subtitle: 'Safe Shelter & Basic Needs',
      color: 'var(--cove-tidal)',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
      stats: [
        { label: 'Children Currently in Care', value: String(activeNow.length) },
        { label: 'New Admissions This Year', value: String(admittedThisYear.length) },
        { label: 'Active Safehouses', value: String(safehouses.filter(s => s.status === 'Active').length) },
        { label: 'Total Bed Capacity', value: String(safehouses.reduce((s, h) => s + (h.capacityGirls ?? 0), 0)) },
      ],
    },
    {
      title: 'HEALING',
      subtitle: 'Psychosocial & Health Services',
      color: 'var(--cove-seaglass)',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
      ),
      stats: [
        { label: 'Process Recordings Completed', value: String(totalProc) },
        { label: 'Home / Family Visitations', value: String(totalVisits) },
        { label: 'Incident Reports Filed', value: String(totalIncidents) },
        { label: 'Avg. Health Score', value: metrics.length ? `${(metrics.reduce((s, m) => s + (m.avgHealthScore ?? 0), 0) / metrics.filter(m => m.avgHealthScore != null).length).toFixed(1)} / 5` : '—' },
      ],
    },
    {
      title: 'TEACHING',
      subtitle: 'Education & Skills Development',
      color: 'var(--cove-seafoam)',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
      ),
      stats: [
        { label: 'Avg. Education Progress', value: metrics.length ? `${Math.round(metrics.reduce((s, m) => s + (m.avgEducationProgress ?? 0), 0) / metrics.filter(m => m.avgEducationProgress != null).length)}%` : '—' },
        { label: 'Residents in Education Programs', value: String(activeNow.length) },
        { label: 'Case Conferences Held', value: 'See Upcoming Plans' },
        { label: 'Social Workers Active', value: '—' },
      ],
    },
    {
      title: 'BENEFICIARIES',
      subtitle: 'Reintegration & Outcomes',
      color: 'var(--cove-sand)',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
      stats: [
        { label: 'Reintegrated Survivors', value: String(reintegratedThisYear.length) },
        { label: 'Donors / Supporters', value: '—' },
        { label: `Total Raised ${year} (YTD)`, value: fmtAmt(ytdTotal, currency) },
        { label: 'Total Donations This Year', value: String(ytdDonations.length) },
      ],
    },
  ]

  return (
    <div className="rp-tab-content">
      <div className="rp-annual-header">
        <h2 className="rp-annual-title">Philippine Annual Accomplishment Report</h2>
        <p className="rp-annual-subtitle">
          Lighthouse Sanctuary Philippines · Year {year} · Department of Social Welfare and Development Format
        </p>
      </div>

      {loading ? <p className="rp-empty">Loading data…</p> : (
        <div className="rp-pillars">
          {pillars.map(p => (
            <div key={p.title} className="rp-pillar" style={{ '--pillar-color': p.color } as React.CSSProperties}>
              <div className="rp-pillar-header">
                <span className="rp-pillar-icon">{p.icon}</span>
                <div>
                  <div className="rp-pillar-title">{p.title}</div>
                  <div className="rp-pillar-sub">{p.subtitle}</div>
                </div>
              </div>
              <div className="rp-pillar-stats">
                {p.stats.map(s => (
                  <div key={s.label} className="rp-pillar-stat">
                    <span className="rp-pillar-stat-label">{s.label}</span>
                    <span className="rp-pillar-stat-value">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rp-annual-note">
        <strong>Note:</strong> This report reflects data currently captured in the Cove system.
        Additional narrative sections (success stories, challenges, recommendations) should be
        added manually before submission to DSWD.
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('donations')

  const [donations,  setDonations]  = useState<Donation[]>([])
  const [monthly,    setMonthly]    = useState<MonthlyDonationSummary[]>([])
  const [topDonors,  setTopDonors]  = useState<TopSupporter[]>([])
  const [allocation, setAllocation] = useState<AllocationSummary | null>(null)
  const [metrics,    setMetrics]    = useState<SafehouseMonthlyMetric[]>([])
  const [safehouses, setSafehouses] = useState<Safehouse[]>([])
  const [residents,  setResidents]  = useState<Resident[]>([])
  const [loading,    setLoading]    = useState(true)
  const [lapseRows,  setLapseRows]  = useState<LapseRow[]>([])

  useEffect(() => {
    Promise.allSettled([
      api.getDonations().then(setDonations),
      api.getDonationsMonthlySummary().then(setMonthly),
      api.getTopSupporters(10).then(setTopDonors),
      api.getAllocationSummary().then(setAllocation),
      api.getLatestMetrics().then(setMetrics),
      api.getSafehouses().then(setSafehouses),
      api.getResidents().then(setResidents),
    ]).finally(() => setLoading(false))
  }, [])

  const TABS: { key: Tab; label: string }[] = [
    { key: 'donations', label: 'Donations' },
    { key: 'outcomes',  label: 'Resident Outcomes' },
    { key: 'safehouses', label: 'Safehouse Performance' },
    { key: 'annual',    label: 'Annual Report' },
  ]

  return (
    <div className="rp-page">
      <div className="rp-header">
        <div>
          <h1 className="rp-title">Reports &amp; Analytics</h1>
          <p className="rp-subtitle">
            Lighthouse Sanctuary Philippines ·{' '}
            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        {loading && <span className="rp-loading-badge">Loading…</span>}
      </div>

      <div className="rp-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`rp-tab-btn${tab === t.key ? ' rp-tab-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'donations' && (
        <DonationsTab
          donations={donations}
          monthly={monthly}
          topDonors={topDonors}
          allocation={allocation}
          loading={loading}
          onLapseRowsChange={setLapseRows}
          lapseRows={lapseRows}
        />
      )}
      {tab === 'outcomes' && (
        <OutcomesTab metrics={metrics} safehouses={safehouses} residents={residents} loading={loading} />
      )}
      {tab === 'safehouses' && (
        <SafehouseTab safehouses={safehouses} metrics={metrics} loading={loading} />
      )}
      {tab === 'annual' && (
        <AnnualTab residents={residents} metrics={metrics} donations={donations} safehouses={safehouses} loading={loading} />
      )}
    </div>
  )
}
