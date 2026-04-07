import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../services/apiService'
import type {
  Safehouse, Donation, AllocationSummary,
  SafehouseMonthlyMetric, IncidentReport, UpcomingPlan,
} from '../../services/apiService'
import './AdminDashboardPage.css'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEV_CLASS: Record<string, string> = { High: 'sev-high', Medium: 'sev-med', Low: 'sev-low' }
const CONF_CLASS: Record<string, string> = { Scheduled: 'conf-scheduled', Pending: 'conf-pending', Active: 'conf-scheduled' }

const PROGRAM_COLORS: Record<string, string> = {
  Operations: 'var(--cove-tidal)',
  Education:  'var(--cove-seaglass)',
  Health:     'var(--color-success)',
  Transport:  'var(--cove-sand)',
  Counseling: 'var(--cove-seafoam)',
}

function occupancyClass(occ: number, cap: number) {
  const p = occ / cap
  return p >= 1 ? 'occ-full' : p >= 0.8 ? 'occ-warn' : 'occ-ok'
}

function fmtAmount(amount: number | null, currencyCode: string | null) {
  if (amount == null) return '—'
  const sym = currencyCode === 'USD' ? '$' : currencyCode === 'PHP' ? '₱' : (currencyCode ?? '') + ' '
  return `${sym}${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function thisMonth() {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const [safehouses,   setSafehouses]   = useState<Safehouse[]>([])
  const [donations,    setDonations]    = useState<Donation[]>([])
  const [allocation,   setAllocation]   = useState<AllocationSummary | null>(null)
  const [metrics,      setMetrics]      = useState<SafehouseMonthlyMetric[]>([])
  const [incidents,    setIncidents]    = useState<IncidentReport[]>([])
  const [plans,        setPlans]        = useState<UpcomingPlan[]>([])
  const [residentCount, setResidentCount] = useState(0)
  const [supporterCount, setSupporterCount] = useState(0)
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    Promise.allSettled([
      api.getSafehouses().then(setSafehouses),
      api.getResidents().then(r => setResidentCount(r.filter(x => !x.dateClosed).length)),
      api.getSupporters().then(s => setSupporterCount(s.length)),
      api.getDonations().then(setDonations),
      api.getAllocationSummary().then(setAllocation),
      api.getLatestMetrics().then(setMetrics),
      api.getIncidentReports().then(setIncidents),
      api.getUpcomingPlans().then(setPlans),
    ]).finally(() => setLoading(false))
  }, [])

  const { year: curYear, month: curMonth } = thisMonth()
  const donationsThisMonth = donations.filter(d => {
    if (!d.donationDate) return false
    const dt = new Date(d.donationDate)
    return dt.getFullYear() === curYear && dt.getMonth() + 1 === curMonth
  })
  const totalThisMonth = donationsThisMonth.reduce((s, d) => s + (d.amount ?? 0), 0)
  const mostCommonCurrency = donationsThisMonth[0]?.currencyCode ?? 'PHP'

  const totalOcc = safehouses.reduce((s, h) => s + (h.currentOccupancy ?? 0), 0)
  const totalCap = safehouses.reduce((s, h) => s + (h.capacityGirls ?? 0), 0)
  const openIncidents = incidents.filter(i => !i.resolved).length

  const KPI: { label: string; value: string; sub: string; trend: string; icon: ReactNode }[] = [
    {
      label: 'Active Residents', value: String(residentCount),
      sub: `across ${safehouses.filter(h => h.status === 'Active').length} safehouses`, trend: 'up',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    {
      label: 'Total Capacity', value: String(totalCap),
      sub: totalCap > 0 ? `${Math.round((totalOcc / totalCap) * 100)}% occupied system-wide` : '—',
      trend: totalCap > 0 && totalOcc / totalCap >= 0.9 ? 'warn' : 'up',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
    },
    {
      label: 'Donations This Mo.',
      value: fmtAmount(totalThisMonth, mostCommonCurrency),
      sub: `${donationsThisMonth.length} donation${donationsThisMonth.length !== 1 ? 's' : ''} this month`,
      trend: 'up',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23"/>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      ),
    },
    {
      label: 'Active Supporters', value: String(supporterCount),
      sub: 'total supporters on record', trend: 'up',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      ),
    },
  ]

  const recentDonations = [...donations].slice(0, 6)

  return (
    <div className="ad-page">

      {/* ── Header ── */}
      <div className="ad-header">
        <div>
          <h1 className="ad-title">Admin Dashboard</h1>
          <p className="ad-subtitle">
            Command Center · Lighthouse Sanctuary Philippines ·{' '}
            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="ad-header-badges">
          {openIncidents > 0 && (
            <span className="ad-alert-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              {openIncidents} open incident{openIncidents > 1 ? 's' : ''}
            </span>
          )}
          {loading && <span className="ad-demo-badge">Loading…</span>}
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="ad-kpi-grid">
        {KPI.map(k => (
          <div key={k.label} className={`ad-kpi-card ad-kpi-${k.trend}`}>
            <div className="ad-kpi-top">
              <span className="ad-kpi-icon">{k.icon}</span>
              <span className="ad-kpi-label">{k.label}</span>
            </div>
            <div className="ad-kpi-value">{k.value}</div>
            <div className="ad-kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Safehouse Status ── */}
      <div className="ad-card">
        <div className="ad-card-header">
          <div>
            <h2 className="ad-card-title">Safehouse Occupancy</h2>
            <p className="ad-card-sub">{totalOcc} of {totalCap} beds occupied across all locations</p>
          </div>
          <Link to="/admin/safehouse-locations" className="ad-add-location-btn" title="Find potential new safehouse locations">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Location
          </Link>
        </div>
        <div className="ad-safehouse-grid">
          {safehouses.map(h => {
            const occ = h.currentOccupancy ?? 0
            const cap = h.capacityGirls ?? 1
            const pct = Math.round((occ / cap) * 100)
            const cls = occupancyClass(occ, cap)
            const metric = metrics.find(m => m.safehouseId === h.safehouseId)
            return (
              <div key={h.safehouseId} className={`ad-safehouse-card ${cls}`}>
                <div className="ad-sh-top">
                  <span className="ad-sh-code">{h.safehouseCode ?? `SH${h.safehouseId}`}</span>
                  <span className={`ad-sh-status ${cls}`}>
                    {pct >= 100 ? 'Full' : `${pct}%`}
                  </span>
                </div>
                <div className="ad-sh-name">{h.name}</div>
                <div className="ad-sh-location">{h.city}{h.region ? ` · ${h.region}` : ''}</div>
                <div className="ad-sh-occ-track">
                  <div className="ad-sh-occ-fill" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <div className="ad-sh-stats">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    {occ}/{cap} residents
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    {h.capacityStaff ?? '—'} staff
                  </span>
                </div>
                {metric && (
                  <div className="ad-sh-metrics">
                    <div className="ad-sh-metric">
                      <span>Health</span>
                      <strong>{metric.avgHealthScore != null ? `${Number(metric.avgHealthScore).toFixed(1)}/5` : '—'}</strong>
                    </div>
                    <div className="ad-sh-metric">
                      <span>Education</span>
                      <strong>{metric.avgEducationProgress != null ? `${Math.round(Number(metric.avgEducationProgress))}%` : '—'}</strong>
                    </div>
                    <div className="ad-sh-metric">
                      <span>Incidents</span>
                      <strong className={metric.incidentCount ? 'metric-warn' : ''}>{metric.incidentCount ?? 0}</strong>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Middle row: Upcoming Plans + Incidents ── */}
      <div className="ad-mid-grid">

        <div className="ad-card">
          <h2 className="ad-card-title">Upcoming Case Conferences</h2>
          <p className="ad-card-sub">Next 14 days — {plans.length} scheduled</p>
          <div className="ad-conf-list">
            {plans.length === 0 && !loading && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0.5rem 0' }}>No upcoming plans in the next 14 days.</p>
            )}
            {plans.map(c => (
              <div key={c.planId} className="ad-conf-row">
                <div className="ad-conf-date">
                  {c.caseConferenceDate ? new Date(c.caseConferenceDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                </div>
                <div className="ad-conf-main">
                  <div className="ad-conf-resident">{c.residentCode ?? `R-${c.residentId}`}</div>
                  <div className="ad-conf-meta">
                    {c.planCategory ?? 'Plan'}
                    {c.safehouseId ? ` · SH${c.safehouseId}` : ''}
                    {c.assignedSocialWorker ? ` · ${c.assignedSocialWorker}` : ''}
                  </div>
                </div>
                <span className={`ad-tag ${CONF_CLASS[c.status ?? ''] ?? 'conf-pending'}`}>
                  {c.status ?? 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="ad-card">
          <h2 className="ad-card-title">Incident Reports</h2>
          <p className="ad-card-sub">{openIncidents} open · {incidents.filter(i => i.resolved).length} resolved</p>
          <div className="ad-incident-list">
            {incidents.length === 0 && !loading && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0.5rem 0' }}>No incident reports on record.</p>
            )}
            {incidents.slice(0, 6).map(i => (
              <div key={i.incidentId} className={`ad-incident-row ${i.resolved ? 'inc-resolved' : ''}`}>
                <div className="ad-inc-left">
                  <span className={`ad-sev-dot ${SEV_CLASS[i.severity ?? ''] ?? 'sev-low'}`} />
                  <div>
                    <div className="ad-inc-title">{i.incidentType} — R-{i.residentId}</div>
                    <div className="ad-inc-meta">{i.reportedBy ?? '—'} · {i.incidentDate ?? '—'}</div>
                  </div>
                </div>
                <div className="ad-inc-right">
                  <span className={`ad-tag ${SEV_CLASS[i.severity ?? ''] ?? 'sev-low'}`}>{i.severity ?? '—'}</span>
                  {!i.resolved && <span className="ad-tag inc-open">Open</span>}
                  {i.resolved && <span className="ad-tag inc-closed">Resolved</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom row: Recent Donations + Allocations ── */}
      <div className="ad-bottom-grid">

        <div className="ad-card">
          <h2 className="ad-card-title">Recent Donation Activity</h2>
          <p className="ad-card-sub">Latest donations — most recent first</p>
          <table className="ad-table">
            <thead>
              <tr>
                <th>Supporter</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentDonations.map(d => (
                <tr key={d.donationId}>
                  <td className="ad-td-name">{d.supporterName}</td>
                  <td>
                    <span className={`ad-tag dtype-${d.isRecurring ? 'monetary' : 'monetary'}`}>
                      {d.isRecurring ? 'Monthly' : 'One-Time'}
                    </span>
                  </td>
                  <td className="ad-td-amount">{fmtAmount(d.amount, d.currencyCode)}</td>
                  <td className="ad-td-program">{d.donationType ?? d.channelSource ?? '—'}</td>
                  <td className="ad-td-date">{fmtDate(d.donationDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ad-card">
          <h2 className="ad-card-title">Donation Allocations</h2>
          <p className="ad-card-sub">Where contributions are going by program area</p>
          {allocation && (
            <>
              <div className="ad-alloc-list">
                {allocation.breakdown.map(a => {
                  const pctVal = allocation.total > 0 ? Math.round((a.amountAllocated / allocation.total) * 100) : 0
                  return (
                    <div key={a.programArea} className="ad-alloc-row">
                      <div className="ad-alloc-meta">
                        <span className="ad-alloc-dot" style={{ background: PROGRAM_COLORS[a.programArea] ?? 'var(--border-medium)' }} />
                        <span className="ad-alloc-label">{a.programArea}</span>
                        <span className="ad-alloc-amount">{fmtAmount(a.amountAllocated, 'PHP')}</span>
                        <span className="ad-alloc-pct">{pctVal}%</span>
                      </div>
                      <div className="ad-alloc-track">
                        <div
                          className="ad-alloc-fill"
                          style={{ width: `${pctVal}%`, background: PROGRAM_COLORS[a.programArea] ?? 'var(--border-medium)' }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="ad-summary-box">
                <div className="ad-summary-row">
                  <span>Total Allocated</span>
                  <strong>{fmtAmount(allocation.total, 'PHP')}</strong>
                </div>
                <div className="ad-summary-row ad-summary-total">
                  <span>Total Supporters on Record</span>
                  <strong>{supporterCount}</strong>
                </div>
              </div>
            </>
          )}
          {!allocation && !loading && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0.5rem 0' }}>No allocation data available.</p>
          )}
        </div>
      </div>

      {/* ── History Log ── */}
      <div className="ad-card">
        <h2 className="ad-card-title">Recent Activity Log</h2>
        <p className="ad-card-sub">Latest system activity across donations, incidents, and case plans</p>
        <div className="ad-history-list">
          {[
            ...donations.slice(0, 4).map(d => ({
              type: 'donation' as const,
              date: d.donationDate,
              label: `New donation recorded`,
              detail: `${d.supporterName} · ${fmtAmount(d.amount, d.currencyCode)} · ${d.isRecurring ? 'Monthly' : 'One-time'}`,
              id: `d-${d.donationId}`,
            })),
            ...incidents.slice(0, 4).map(i => ({
              type: 'incident' as const,
              date: i.incidentDate,
              label: `Incident report filed`,
              detail: `${i.incidentType ?? 'Incident'} · Resident R-${i.residentId} · ${i.severity ?? 'Unknown'} severity`,
              id: `i-${i.incidentId}`,
            })),
            ...plans.slice(0, 4).map(p => ({
              type: 'plan' as const,
              date: p.caseConferenceDate,
              label: `Case conference scheduled`,
              detail: `${p.residentCode ?? `R-${p.residentId}`} · ${p.planCategory ?? 'Plan'} · ${p.assignedSocialWorker ?? 'Unassigned'}`,
              id: `p-${p.planId}`,
            })),
          ]
            .filter(e => e.date)
            .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
            .slice(0, 10)
            .map(event => (
              <div key={event.id} className="ad-history-row">
                <span className={`ad-history-dot ad-hist-${event.type}`} />
                <div className="ad-history-body">
                  <div className="ad-history-label">{event.label}</div>
                  <div className="ad-history-detail">{event.detail}</div>
                </div>
                <div className="ad-history-date">
                  {new Date(event.date!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            ))}
          {!loading && donations.length === 0 && incidents.length === 0 && plans.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0.5rem 0' }}>No recent activity to display.</p>
          )}
        </div>
      </div>

    </div>
  )
}
