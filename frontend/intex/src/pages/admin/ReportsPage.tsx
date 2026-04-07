import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { api } from '../../services/apiService'
import type {
  Donation, MonthlyDonationSummary, TopSupporter,
  AllocationSummary, SafehouseMonthlyMetric, Safehouse, Resident,
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
  const pts = data.slice(-12)
  const vals = pts.map(d => d.total)
  const maxV = Math.max(...vals, 1)
  const minV = 0
  const xp = (i: number) => PAD.left + (i / (pts.length - 1)) * iW
  const yp = (v: number) => PAD.top + iH - ((v - minV) / (maxV - minV)) * iH
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => minV + t * (maxV - minV))
  const polyline = pts.map((p, i) => `${xp(i)},${yp(p.total)}`).join(' ')
  const area = `M ${xp(0)} ${yp(pts[0].total)} ` +
    pts.map((p, i) => `L ${xp(i)} ${yp(p.total)}`).join(' ') +
    ` L ${xp(pts.length - 1)} ${PAD.top + iH} L ${PAD.left} ${PAD.top + iH} Z`

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
      {pts.map((p, i) => (
        <text key={i} x={xp(i)} y={CH - 4} textAnchor="middle" fontSize="10" fill="var(--text-muted)">
          {monthLabel(p.month)}
        </text>
      ))}
      {/* Area */}
      <path d={area} fill="var(--cove-tidal)" opacity="0.12" />
      {/* Line */}
      <polyline points={polyline} fill="none" stroke="var(--cove-tidal)" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Dots */}
      {pts.map((p, i) => (
        <circle key={i} cx={xp(i)} cy={yp(p.total)} r="4" fill="var(--cove-tidal)" stroke="white" strokeWidth="1.5" />
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

// ─── Tab: Donations ────────────────────────────────────────────────────────────

function DonationsTab({
  donations, monthly, topDonors, allocation, loading,
}: {
  donations: Donation[]
  monthly: MonthlyDonationSummary[]
  topDonors: TopSupporter[]
  allocation: AllocationSummary | null
  loading: boolean
}) {
  const now = new Date()
  const curYear = now.getFullYear()
  const curMonth = now.getMonth() + 1
  const ytd = monthly.filter(m => m.year === curYear).reduce((s, m) => s + m.total, 0)
  const thisMonth = monthly.find(m => m.year === curYear && m.month === curMonth)
  const total = donations.reduce((s, d) => s + (d.amount ?? 0), 0)
  const avg = donations.length ? total / donations.length : 0
  const recurring = donations.filter(d => d.isRecurring).length
  const currency = donations[0]?.currencyCode ?? 'PHP'

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

      <div className="rp-section">
        <h3 className="rp-section-title">Monthly Donation Trend (Last 12 Months)</h3>
        {loading ? <p className="rp-empty">Loading…</p> : <LineChart data={monthly} />}
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
        <DonationsTab donations={donations} monthly={monthly} topDonors={topDonors} allocation={allocation} loading={loading} />
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
