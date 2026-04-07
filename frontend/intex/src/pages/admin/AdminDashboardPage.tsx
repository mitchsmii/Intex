import type { ReactNode } from 'react'
import './AdminDashboardPage.css'

// ─── Fake data modelled on lighthouse_csv_v7 ─────────────────────────────────

const SAFEHOUSES = [
  { code: 'SH01', name: 'Lighthouse Safehouse 1', region: 'Luzon',    city: 'Quezon City', capacity: 8,  occupancy: 8,  staff: 4, status: 'Active' },
  { code: 'SH02', name: 'Lighthouse Safehouse 2', region: 'Visayas',  city: 'Cebu City',   capacity: 10, occupancy: 8,  staff: 5, status: 'Active' },
  { code: 'SH03', name: 'Lighthouse Safehouse 3', region: 'Mindanao', city: 'Davao City',  capacity: 9,  occupancy: 9,  staff: 4, status: 'Active' },
  { code: 'SH04', name: 'Lighthouse Safehouse 4', region: 'Visayas',  city: 'Iloilo City', capacity: 12, occupancy: 12, staff: 4, status: 'Active' },
]

const KPI: { label: string; value: string; sub: string; trend: string; icon: ReactNode }[] = [
  {
    label: 'Active Residents', value: '37', sub: 'across 4 safehouses', trend: 'up',
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
    label: 'Total Capacity', value: '39', sub: '95% occupied system-wide', trend: 'warn',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    label: 'Donations This Mo.', value: '₱42,350', sub: '+18% vs last month', trend: 'up',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  {
    label: 'Active Supporters', value: '61', sub: '12 new this quarter', trend: 'up',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    ),
  },
]

const PROGRESS_BY_HOUSE = [
  { code: 'SH01', healthScore: 3.6, educationPct: 74, incidents: 0 },
  { code: 'SH02', healthScore: 3.2, educationPct: 68, incidents: 1 },
  { code: 'SH03', healthScore: 3.5, educationPct: 79, incidents: 0 },
  { code: 'SH04', healthScore: 3.1, educationPct: 63, incidents: 2 },
]

const CASE_CONFERENCES = [
  { id: 1,  residentCode: 'LS-0001', planCategory: 'Safety',     date: 'Apr 10, 2025', status: 'Scheduled', safehouse: 'SH04', worker: 'SW-15' },
  { id: 2,  residentCode: 'LS-0008', planCategory: 'Education',  date: 'Apr 11, 2025', status: 'Scheduled', safehouse: 'SH02', worker: 'SW-12' },
  { id: 3,  residentCode: 'LS-0014', planCategory: 'Reintegration', date: 'Apr 14, 2025', status: 'Pending', safehouse: 'SH01', worker: 'SW-20' },
  { id: 4,  residentCode: 'LS-0021', planCategory: 'Health',     date: 'Apr 16, 2025', status: 'Scheduled', safehouse: 'SH03', worker: 'SW-09' },
  { id: 5,  residentCode: 'LS-0033', planCategory: 'Safety',     date: 'Apr 18, 2025', status: 'Pending',   safehouse: 'SH04', worker: 'SW-15' },
]

const INCIDENTS = [
  { id: 1, residentCode: 'LS-0001', safehouse: 'SH04', type: 'Security', severity: 'High',   date: 'Feb 10, 2026', resolved: false, followUp: true  },
  { id: 2, residentCode: 'LS-0017', safehouse: 'SH02', type: 'Medical',  severity: 'Medium', date: 'Mar 28, 2025', resolved: false, followUp: true  },
  { id: 3, residentCode: 'LS-0009', safehouse: 'SH01', type: 'Behavioral', severity: 'Low',  date: 'Mar 15, 2025', resolved: true,  followUp: false },
  { id: 4, residentCode: 'LS-0025', safehouse: 'SH03', type: 'Medical',  severity: 'Low',    date: 'Mar 12, 2025', resolved: true,  followUp: false },
]

const RECENT_DONATIONS = [
  { id: 1,  supporter: 'Mila Alvarez',    type: 'Monetary',       amount: '₱1,074',  source: 'PartnerReferral', date: 'Apr 5, 2025',  program: 'Education'   },
  { id: 2,  supporter: 'Anonymous',       type: 'Time',           amount: '35 hrs',  source: 'Event',           date: 'Apr 4, 2025',  program: 'Transport'   },
  { id: 3,  supporter: 'Grace Church',    type: 'Monetary',       amount: '₱5,000',  source: 'Church',          date: 'Apr 3, 2025',  program: 'Operations'  },
  { id: 4,  supporter: 'Noah Chen',       type: 'In-Kind',        amount: '₱800 est',source: 'SocialMedia',     date: 'Apr 2, 2025',  program: 'Health'      },
  { id: 5,  supporter: 'Liam Diaz',       type: 'Monetary',       amount: '₱1,230',  source: 'PartnerReferral', date: 'Apr 1, 2025',  program: 'Operations'  },
  { id: 6,  supporter: 'Sofia Reyes',     type: 'Skills',         amount: '12 hrs',  source: 'SocialMedia',     date: 'Mar 30, 2025', program: 'Counseling'  },
]

const ALLOCATION_SUMMARY = [
  { program: 'Operations', pct: 34, amount: '₱14,399' },
  { program: 'Education',  pct: 26, amount: '₱11,011' },
  { program: 'Health',     pct: 20, amount: '₱8,470'  },
  { program: 'Transport',  pct: 12, amount: '₱5,082'  },
  { program: 'Counseling', pct: 8,  amount: '₱3,388'  },
]

const PROGRAM_COLORS: Record<string, string> = {
  Operations: 'var(--cove-tidal)',
  Education:  'var(--cove-seaglass)',
  Health:     'var(--color-success)',
  Transport:  'var(--cove-sand)',
  Counseling: 'var(--cove-seafoam)',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEV_CLASS: Record<string, string> = { High: 'sev-high', Medium: 'sev-med', Low: 'sev-low' }
const CONF_CLASS: Record<string, string> = { Scheduled: 'conf-scheduled', Pending: 'conf-pending' }

function occupancyClass(occ: number, cap: number) {
  const p = occ / cap
  return p >= 1 ? 'occ-full' : p >= 0.8 ? 'occ-warn' : 'occ-ok'
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const totalOcc = SAFEHOUSES.reduce((s, h) => s + h.occupancy, 0)
  const totalCap = SAFEHOUSES.reduce((s, h) => s + h.capacity, 0)
  const openIncidents = INCIDENTS.filter(i => !i.resolved).length

  return (
    <div className="ad-page">

      {/* ── Header ── */}
      <div className="ad-header">
        <div>
          <h1 className="ad-title">Admin Dashboard</h1>
          <p className="ad-subtitle">Command Center · Lighthouse Sanctuary Philippines · April 6, 2025</p>
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
          <span className="ad-demo-badge">Demo Data</span>
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
        </div>
        <div className="ad-safehouse-grid">
          {SAFEHOUSES.map(h => {
            const pct = Math.round((h.occupancy / h.capacity) * 100)
            const cls = occupancyClass(h.occupancy, h.capacity)
            const prog = PROGRESS_BY_HOUSE.find(p => p.code === h.code)!
            return (
              <div key={h.code} className={`ad-safehouse-card ${cls}`}>
                <div className="ad-sh-top">
                  <span className="ad-sh-code">{h.code}</span>
                  <span className={`ad-sh-status ${cls}`}>
                    {pct === 100 ? 'Full' : `${pct}%`}
                  </span>
                </div>
                <div className="ad-sh-name">{h.name}</div>
                <div className="ad-sh-location">{h.city} · {h.region}</div>
                <div className="ad-sh-occ-track">
                  <div className="ad-sh-occ-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="ad-sh-stats">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    {h.occupancy}/{h.capacity} residents
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    {h.staff} staff
                  </span>
                </div>
                <div className="ad-sh-metrics">
                  <div className="ad-sh-metric">
                    <span>Health</span>
                    <strong>{prog.healthScore.toFixed(1)}/5.0</strong>
                  </div>
                  <div className="ad-sh-metric">
                    <span>Education</span>
                    <strong>{prog.educationPct}%</strong>
                  </div>
                  <div className="ad-sh-metric">
                    <span>Incidents</span>
                    <strong className={prog.incidents > 0 ? 'metric-warn' : ''}>{prog.incidents}</strong>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Middle row: Conferences + Incidents ── */}
      <div className="ad-mid-grid">

        {/* Upcoming Case Conferences */}
        <div className="ad-card">
          <h2 className="ad-card-title">Upcoming Case Conferences</h2>
          <p className="ad-card-sub">Next 14 days — {CASE_CONFERENCES.length} scheduled</p>
          <div className="ad-conf-list">
            {CASE_CONFERENCES.map(c => (
              <div key={c.id} className="ad-conf-row">
                <div className="ad-conf-date">{c.date.split(',')[0]}</div>
                <div className="ad-conf-main">
                  <div className="ad-conf-resident">{c.residentCode}</div>
                  <div className="ad-conf-meta">{c.planCategory} · {c.safehouse} · {c.worker}</div>
                </div>
                <span className={`ad-tag ${CONF_CLASS[c.status]}`}>{c.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Incident Reports */}
        <div className="ad-card">
          <h2 className="ad-card-title">Incident Reports</h2>
          <p className="ad-card-sub">{openIncidents} open · {INCIDENTS.filter(i => i.resolved).length} resolved</p>
          <div className="ad-incident-list">
            {INCIDENTS.map(i => (
              <div key={i.id} className={`ad-incident-row ${i.resolved ? 'inc-resolved' : ''}`}>
                <div className="ad-inc-left">
                  <span className={`ad-sev-dot ${SEV_CLASS[i.severity]}`} />
                  <div>
                    <div className="ad-inc-title">{i.type} — {i.residentCode}</div>
                    <div className="ad-inc-meta">{i.safehouse} · {i.date}</div>
                  </div>
                </div>
                <div className="ad-inc-right">
                  <span className={`ad-tag ${SEV_CLASS[i.severity]}`}>{i.severity}</span>
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

        {/* Recent Donations */}
        <div className="ad-card">
          <h2 className="ad-card-title">Recent Donation Activity</h2>
          <p className="ad-card-sub">All contribution types — monetary, time, in-kind, skills</p>
          <table className="ad-table">
            <thead>
              <tr>
                <th>Supporter</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Program</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_DONATIONS.map(d => (
                <tr key={d.id}>
                  <td className="ad-td-name">{d.supporter}</td>
                  <td>
                    <span className={`ad-tag dtype-${d.type.replace(/[- ]/g, '').toLowerCase()}`}>
                      {d.type}
                    </span>
                  </td>
                  <td className="ad-td-amount">{d.amount}</td>
                  <td className="ad-td-program">{d.program}</td>
                  <td className="ad-td-date">{d.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Donation Allocation Summary */}
        <div className="ad-card">
          <h2 className="ad-card-title">Donation Allocations</h2>
          <p className="ad-card-sub">Where contributions are going this month</p>
          <div className="ad-alloc-list">
            {ALLOCATION_SUMMARY.map(a => (
              <div key={a.program} className="ad-alloc-row">
                <div className="ad-alloc-meta">
                  <span className="ad-alloc-dot" style={{ background: PROGRAM_COLORS[a.program] ?? 'var(--border-medium)' }} />
                  <span className="ad-alloc-label">{a.program}</span>
                  <span className="ad-alloc-amount">{a.amount}</span>
                  <span className="ad-alloc-pct">{a.pct}%</span>
                </div>
                <div className="ad-alloc-track">
                  <div
                    className="ad-alloc-fill"
                    style={{ width: `${a.pct}%`, background: PROGRAM_COLORS[a.program] ?? 'var(--border-medium)' }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* System summary */}
          <div className="ad-summary-box">
            <div className="ad-summary-row"><span>Total Monetary Donations</span><strong>₱42,350</strong></div>
            <div className="ad-summary-row"><span>In-Kind & Time Contributions</span><strong>47 hrs + ₱800 est.</strong></div>
            <div className="ad-summary-row ad-summary-total"><span>Total Supporters on Record</span><strong>61</strong></div>
          </div>
        </div>
      </div>

    </div>
  )
}
