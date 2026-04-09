import { useState, useEffect } from 'react'
import { api } from '../../../services/apiService'
import type {
  Donation, MonthlyDonationSummary, TopSupporter,
  AllocationSummary, SafehouseMonthlyMetric, Safehouse,
} from '../../../services/apiService'
import DeleteConfirmModal from '../../../components/common/DeleteConfirmModal'
import './DonationReportPage.css'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtUSD(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function fmtPHP(n: number) {
  return '₱' + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtAmount(n: number | null, currency?: string | null) {
  if (n == null) return '—'
  if (currency === 'USD') return fmtUSD(n)
  return fmtPHP(n)
}

function monthLabel(month: number) {
  return new Date(2000, month - 1, 1).toLocaleString('en-US', { month: 'short' })
}

function pct(current: number, target: number) {
  return Math.min(100, Math.round((current / target) * 100))
}

const STATIC_THRESHOLDS = [
  { label: 'Essential Operations',  target: 11_000,  desc: 'Minimum to keep doors open monthly' },
  { label: 'Full Program Capacity', target: 25_000,  desc: 'All programs fully staffed & funded' },
  { label: 'Wheels of Hope Van',    target: 35_000,  desc: 'One-time transportation campaign'    },
  { label: 'New Shelter Expansion', target: 100_000, desc: 'Capital goal to open a second shelter — 18 additional beds for survivors' },
]

// ─── SVG Line Chart ───────────────────────────────────────────────────────────

const CHART_W = 800
const CHART_H = 220
const PAD = { top: 20, right: 20, bottom: 36, left: 64 }
const innerW = CHART_W - PAD.left - PAD.right
const innerH = CHART_H - PAD.top  - PAD.bottom

const Y_TICKS = 5

function buildChart(
  monthly: MonthlyDonationSummary[],
  burnByMonth: { month: number; year: number; burn: number }[]
) {
  if (monthly.length === 0) return null

  // Last 12 months
  const pts = monthly.slice(-12)
  const allVals = [
    ...pts.map(d => d.total),
    ...burnByMonth.filter(b => pts.some(p => p.year === b.year && p.month === b.month)).map(b => b.burn),
  ]
  if (allVals.length === 0) return null

  const yMin = Math.floor(Math.min(...allVals, 0) / 1000) * 1000
  const yMax = Math.ceil(Math.max(...allVals)  / 1000) * 1000 + 1000

  const xPos = (i: number) => PAD.left + (i / Math.max(pts.length - 1, 1)) * innerW
  const yPos = (val: number) => PAD.top + innerH - ((val - yMin) / (yMax - yMin)) * innerH
  const ticks = Array.from({ length: Y_TICKS + 1 }, (_, i) => yMin + (i / Y_TICKS) * (yMax - yMin))

  return { pts, yMin, yMax, xPos, yPos, ticks, burnByMonth }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DonationReportPage() {
  const [donations,   setDonations]   = useState<Donation[]>([])
  const [monthly,     setMonthly]     = useState<MonthlyDonationSummary[]>([])
  const [topDonors,   setTopDonors]   = useState<TopSupporter[]>([])
  const [allocation,  setAllocation]  = useState<AllocationSummary | null>(null)
  const [_metrics,    setMetrics]      = useState<SafehouseMonthlyMetric[]>([])
  const [safehouses,  setSafehouses]  = useState<Safehouse[]>([])
  const [loading,     setLoading]     = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<Donation | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!deleteTarget?.donationId) return
    setDeleting(true)
    try {
      await api.deleteDonation(deleteTarget.donationId)
      setDonations(prev => prev.filter(d => d.donationId !== deleteTarget.donationId))
      setDeleteTarget(null)
    } catch { /* ignore */ }
    finally { setDeleting(false) }
  }

  useEffect(() => {
    Promise.allSettled([
      api.getDonations().then(setDonations),
      api.getDonationsMonthlySummary().then(setMonthly),
      api.getTopSupporters(5).then(setTopDonors),
      api.getAllocationSummary().then(setAllocation),
      api.getLatestMetrics().then(setMetrics),
      api.getSafehouses().then(setSafehouses),
    ]).finally(() => setLoading(false))
  }, [])

  const now = new Date()
  const curYear  = now.getFullYear()
  const curMonth = now.getMonth() + 1

  // KPI derivations
  const ytdTotal    = monthly.filter(m => m.year === curYear).reduce((s, m) => s + m.total, 0)
  const lastMonth   = monthly.find(m => m.year === curYear && m.month === curMonth) ?? monthly.at(-1)
  const monthlyRecurring = donations.filter(d => {
    if (!d.donationDate) return false
    const dt = new Date(d.donationDate)
    return d.isRecurring && dt.getFullYear() === curYear && dt.getMonth() + 1 === curMonth
  }).reduce((s, d) => s + (d.amount ?? 0), 0)
  const totalCount  = donations.length
  const avgDonation = totalCount > 0 ? donations.reduce((s, d) => s + (d.amount ?? 0), 0) / totalCount : 0
  const allDonationsTotal = donations.reduce((s, d) => s + (d.amount ?? 0), 0)

  // Burn from metrics — real schema has no expenses; skip burn overlay
  const burnByMonth: { month: number; year: number; burn: number }[] = []
  const totalMonthlyBurn = 0

  const chart = buildChart(monthly, burnByMonth)

  // Shelter aggregate
  const totalCap = safehouses.reduce((s, h) => s + (h.capacityGirls ?? 0), 0)
  const totalOcc = safehouses.reduce((s, h) => s + (h.currentOccupancy ?? 0), 0)
  const available = totalCap - totalOcc

  // Payment method breakdown for "Donor Sources"
  const methodCounts: Record<string, number> = {}
  for (const d of donations) {
    const m = d.channelSource ?? 'Unknown'
    methodCounts[m] = (methodCounts[m] ?? 0) + 1
  }
  const totalMethodCount = Object.values(methodCounts).reduce((a, b) => a + b, 0)
  const PALETTE = ['var(--cove-tidal)', 'var(--cove-seaglass)', 'var(--cove-seafoam)', 'var(--cove-sand)', 'var(--border-medium)']
  const sources = Object.entries(methodCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count], i) => ({
      label,
      pct: totalMethodCount > 0 ? Math.round((count / totalMethodCount) * 100) : 0,
      color: PALETTE[i] ?? 'var(--border-medium)',
    }))

  const netThisMonth = (lastMonth?.total ?? 0) - totalMonthlyBurn

  const recentDonations = [...donations].slice(0, 6)
  const mostCommonCurrency = donations[0]?.currencyCode ?? 'PHP'

  return (
    <div className="dr-page">
      <DeleteConfirmModal
        open={!!deleteTarget}
        title="Delete Donation"
        message={deleteTarget ? `Delete this ${deleteTarget.isRecurring ? 'recurring' : 'one-time'} donation of ${deleteTarget.amount?.toLocaleString() ?? '?'}?` : ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      {/* ── Header ── */}
      <div className="dr-header">
        <div>
          <h1 className="dr-title">Donation &amp; Contributions Report</h1>
          <p className="dr-subtitle">
            Staff &amp; Manager View · Data as of{' '}
            {now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        {loading && <span className="dr-badge">Loading…</span>}
      </div>

      {/* ── KPI Cards ── */}
      <div className="dr-kpi-grid">
        {[
          {
            label: 'Total Raised (YTD)',
            value: fmtAmount(ytdTotal, mostCommonCurrency),
            sub: `${monthly.filter(m => m.year === curYear).reduce((s, m) => s + (m.count ?? 0), 0)} donations this year`,
            trend: 'up',
          },
          {
            label: 'Monthly Recurring',
            value: fmtAmount(monthlyRecurring, mostCommonCurrency),
            sub: 'recurring donations this month',
            trend: 'warn',
          },
          {
            label: 'Average Donation',
            value: fmtAmount(avgDonation, mostCommonCurrency),
            sub: `across ${totalCount} total donation${totalCount !== 1 ? 's' : ''}`,
            trend: 'up',
          },
          {
            label: 'Total Raised (All Time)',
            value: fmtAmount(allDonationsTotal, mostCommonCurrency),
            sub: `${totalCount} total donations on record`,
            trend: 'up',
          },
        ].map(card => (
          <div key={card.label} className={`dr-kpi-card dr-kpi-${card.trend}`}>
            <div className="dr-kpi-label">{card.label}</div>
            <div className="dr-kpi-value">{card.value}</div>
            <div className="dr-kpi-sub">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Burn Rate Panel ── */}
      {totalMonthlyBurn > 0 && (
        <div className="dr-burn-panel">
          <div className="dr-burn-panel-title">Monthly Cash Flow</div>
          <div className="dr-burn-stats">
            <div className="dr-burn-stat dr-burn-in">
              <div className="dr-burn-stat-label">Donations In</div>
              <div className="dr-burn-stat-value">{fmtAmount(lastMonth?.total ?? 0, mostCommonCurrency)}</div>
            </div>
            <div className="dr-burn-divider">–</div>
            <div className="dr-burn-stat dr-burn-out">
              <div className="dr-burn-stat-label">Operating Costs</div>
              <div className="dr-burn-stat-value">{fmtAmount(totalMonthlyBurn, 'PHP')}</div>
            </div>
            <div className="dr-burn-divider">=</div>
            <div className={`dr-burn-stat dr-burn-net ${netThisMonth >= 0 ? 'net-pos' : 'net-neg'}`}>
              <div className="dr-burn-stat-label">Net This Month</div>
              <div className="dr-burn-stat-value">
                {netThisMonth >= 0 ? '+' : ''}{fmtAmount(netThisMonth, mostCommonCurrency)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Line Chart: Income trend ── */}
      {chart && (
        <div className="dr-card">
          <h2 className="dr-card-title">Donation Income — Monthly Trend</h2>
          <p className="dr-card-sub">Monthly donation totals over the last {chart.pts.length} months</p>

          <div className="dr-linechart-legend">
            <span className="legend-income">● Donations</span>
            {burnByMonth.length > 0 && <span className="legend-burn">● Operating Costs</span>}
          </div>

          <div className="dr-linechart-wrap">
            <svg
              viewBox={`0 0 ${CHART_W} ${CHART_H}`}
              className="dr-linechart-svg"
              aria-label="Monthly donation income chart"
            >
              {chart.ticks.map(tick => (
                <g key={tick}>
                  <line
                    x1={PAD.left} y1={chart.yPos(tick)}
                    x2={CHART_W - PAD.right} y2={chart.yPos(tick)}
                    stroke="#dfe8e4" strokeWidth="1"
                  />
                  <text x={PAD.left - 8} y={chart.yPos(tick) + 4}
                    textAnchor="end" fontSize="11" fill="#8a9f9f">
                    {fmtPHP(tick)}
                  </text>
                </g>
              ))}

              <polygon
                points={[
                  `${PAD.left},${PAD.top + innerH}`,
                  ...chart.pts.map((d, i) => `${chart.xPos(i)},${chart.yPos(d.total)}`),
                  `${chart.xPos(chart.pts.length - 1)},${PAD.top + innerH}`,
                ].join(' ')}
                fill="rgba(94,158,160,0.1)"
              />

              <polyline
                points={chart.pts.map((d, i) => `${chart.xPos(i)},${chart.yPos(d.total)}`).join(' ')}
                fill="none" stroke="#5e9ea0" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"
              />

              {burnByMonth.length > 0 && (() => {
                const burnPts = chart.pts.map(p => {
                  const b = burnByMonth.find(x => x.year === p.year && x.month === p.month)
                  return b?.burn ?? null
                })
                const hasBurn = burnPts.some(b => b != null)
                if (!hasBurn) return null
                return (
                  <polyline
                    points={burnPts
                      .map((b, i) => b != null ? `${chart.xPos(i)},${chart.yPos(b)}` : null)
                      .filter(Boolean).join(' ')}
                    fill="none" stroke="#d4a44a" strokeWidth="2.5"
                    strokeLinejoin="round" strokeDasharray="6 3"
                  />
                )
              })()}

              {chart.pts.map((d, i) => (
                <circle key={`in-${i}`} cx={chart.xPos(i)} cy={chart.yPos(d.total)}
                  r="5" fill="#5e9ea0" stroke="white" strokeWidth="2.5" />
              ))}

              {chart.pts.map((d, i) => (
                <text key={d.month} x={chart.xPos(i)} y={CHART_H - 8}
                  textAnchor="middle" fontSize="11" fill="#8a9f9f">
                  {monthLabel(d.month)}
                </text>
              ))}
            </svg>
          </div>
        </div>
      )}

      {/* ── Mid grid: Thresholds + Sources ── */}
      <div className="dr-mid-grid">

        <div className="dr-card">
          <h2 className="dr-card-title">Funding Thresholds</h2>
          <p className="dr-card-sub">Progress toward each operational requirement (monthly USD equiv.)</p>
          <div className="dr-thresholds">
            {STATIC_THRESHOLDS.map(t => {
              const current = lastMonth?.total ?? 0
              const p = pct(current, t.target)
              const cls = p >= 80 ? 'thresh-good' : p >= 50 ? 'thresh-warn' : 'thresh-low'
              return (
                <div key={t.label} className="dr-threshold-row">
                  <div className="dr-threshold-top">
                    <span className="dr-threshold-label">{t.label}</span>
                    <span className={`dr-threshold-pct ${cls}`}>{p}%</span>
                  </div>
                  <div className="dr-threshold-desc">{t.desc}</div>
                  <div className="dr-prog-track">
                    <div className={`dr-prog-fill ${cls}`} style={{ width: `${p}%` }} />
                  </div>
                  <div className="dr-threshold-amounts">
                    <span>{fmtUSD(current)} raised</span>
                    <span>Goal: {fmtUSD(t.target)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="dr-card">
          <h2 className="dr-card-title">Donation by Payment Method</h2>
          <p className="dr-card-sub">How donors are giving</p>
          <div className="dr-sources">
            {sources.map(s => (
              <div key={s.label} className="dr-source-row">
                <div className="dr-source-meta">
                  <span className="dr-source-dot" style={{ background: s.color }} />
                  <span className="dr-source-label">{s.label}</span>
                  <span className="dr-source-pct">{s.pct}%</span>
                </div>
                <div className="dr-source-track">
                  <div className="dr-source-fill" style={{ width: `${s.pct}%`, background: s.color }} />
                </div>
              </div>
            ))}
            {sources.length === 0 && !loading && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No payment data available.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Shelter Capacity ── */}
      {safehouses.length > 0 && (
        <div className="dr-card">
          <h2 className="dr-card-title">Shelter Capacity &amp; Occupancy</h2>
          <p className="dr-card-sub">Current occupancy across all safehouses</p>
          <div className="dr-shelter-grid">
            <div className="dr-shelter-occupancy">
              <div className="dr-shelter-occ-label">
                System-Wide Occupancy
                <span className="dr-shelter-occ-count">{totalOcc} / {totalCap}</span>
              </div>
              <div className="dr-shelter-beds">
                {Array.from({ length: Math.min(totalCap, 60) }, (_, i) => (
                  <div
                    key={i}
                    className={`dr-bed ${i < totalOcc ? 'bed-occupied' : 'bed-available'}`}
                    title={i < totalOcc ? 'Occupied' : 'Available'}
                  />
                ))}
              </div>
              <div className="dr-shelter-legend">
                <span><span className="dr-bed-dot bed-occupied" /> Occupied ({totalOcc})</span>
                <span><span className="dr-bed-dot bed-available" /> Available ({available})</span>
              </div>
            </div>
            <div className="dr-shelter-stats">
              {safehouses.map(h => (
                <div key={h.safehouseId} className="dr-shelter-stat-row">
                  <span>{h.name ?? `SH${h.safehouseId}`} — {h.city}</span>
                  <strong>{h.currentOccupancy ?? 0} / {h.capacityGirls ?? 0}</strong>
                </div>
              ))}
            </div>
            <div className="dr-intake-box">
              <div className="dr-intake-number">{available}</div>
              <div className="dr-intake-label">
                bed{available !== 1 ? 's' : ''} available system-wide
                <span className="dr-intake-sub">across all active safehouses</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom: Top Donors + Recent ── */}
      <div className="dr-bottom-grid">

        <div className="dr-card">
          <h2 className="dr-card-title">Top Supporters</h2>
          <p className="dr-card-sub">Ranked by total contribution</p>
          <table className="dr-table">
            <thead>
              <tr>
                <th>#</th><th>Supporter</th><th>Total</th><th>Type</th><th>First Gift</th>
              </tr>
            </thead>
            <tbody>
              {topDonors.map((d, i) => (
                <tr key={d.supporterId ?? i}>
                  <td>
                    <span className={`dr-rank dr-rank-${i + 1 <= 3 ? i + 1 : 'other'}`}>{i + 1}</span>
                  </td>
                  <td className="dr-donor-name">{d.name}</td>
                  <td className="dr-amount">{fmtAmount(d.total, mostCommonCurrency)}</td>
                  <td>
                    <span className={`dr-tag ${d.isRecurring ? 'tag-monthly' : 'tag-onetime'}`}>
                      {d.isRecurring ? 'Monthly' : 'One-Time'}
                    </span>
                  </td>
                  <td className="dr-muted">
                    {d.firstDate ? new Date(d.firstDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
                  </td>
                </tr>
              ))}
              {topDonors.length === 0 && !loading && (
                <tr><td colSpan={5} style={{ color: 'var(--text-muted)', padding: '0.75rem' }}>No donor data available.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="dr-card">
          <h2 className="dr-card-title">Recent Donations</h2>
          <p className="dr-card-sub">Latest activity</p>
          <div className="dr-recent">
            {recentDonations.map(d => (
              <div key={d.donationId} className="dr-recent-row">
                <div className="dr-recent-left">
                  <div className="dr-recent-avatar">{d.supporterName[0]}</div>
                  <div>
                    <div className="dr-recent-name">{d.supporterName}</div>
                    <div className="dr-recent-meta">
                      {d.channelSource ?? 'Unknown'} ·{' '}
                      {d.donationDate ? new Date(d.donationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </div>
                  </div>
                </div>
                <div className="dr-recent-right">
                  <div className="dr-recent-amount">{fmtAmount(d.amount, d.currencyCode)}</div>
                  <span className={`dr-tag ${d.isRecurring ? 'tag-monthly' : 'tag-onetime'}`}>
                    {d.isRecurring ? 'Monthly' : 'One-Time'}
                  </span>
                  <button
                    onClick={() => setDeleteTarget(d)}
                    disabled={deleting}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)', fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                    title="Delete donation"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            {recentDonations.length === 0 && !loading && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0.5rem 0' }}>No donations on record.</p>
            )}
          </div>

          {allocation && (
            <div className="ad-summary-box" style={{ marginTop: '1rem' }}>
              <div className="ad-summary-row"><span>Total Allocated</span><strong>{fmtAmount(allocation.total, 'PHP')}</strong></div>
              <div className="ad-summary-row ad-summary-total"><span>Total Donors</span><strong>{topDonors.length}</strong></div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
