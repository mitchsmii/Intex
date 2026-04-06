import './DonationReportPage.css'

// ─── Fake data ────────────────────────────────────────────────────────────────

const KPI_CARDS = [
  { label: 'Total Raised (YTD)',  value: '$47,230', sub: '+12% vs last year',       trend: 'up'   },
  { label: 'Monthly Recurring',   value: '$8,450',  sub: 'of $11,000 needed/mo',    trend: 'warn' },
  { label: 'Average Donation',    value: '$127.50', sub: 'across 371 donors',        trend: 'up'   },
  { label: 'Burn Rate',           value: '76%',     sub: '$8,360 spent this month',  trend: 'warn' },
]

const THRESHOLDS = [
  { label: 'Essential Operations',  target: 11_000,  current: 8_450,  desc: 'Minimum to keep doors open monthly' },
  { label: 'Full Program Capacity', target: 25_000,  current: 11_730, desc: 'All programs fully staffed & funded' },
  { label: 'Wheels of Hope Van',    target: 35_000,  current: 22_100, desc: 'One-time transportation campaign'    },
  { label: 'New Shelter Expansion', target: 100_000, current: 47_230, desc: 'Capital goal to open a second shelter — 18 additional beds for survivors' },
]

// 12-month income vs burn rate data
const LINE_CHART_DATA = [
  { month: 'May',  income: 5_800,  burn: 7_200  },
  { month: 'Jun',  income: 6_400,  burn: 7_500  },
  { month: 'Jul',  income: 5_100,  burn: 7_800  },
  { month: 'Aug',  income: 7_300,  burn: 8_000  },
  { month: 'Sep',  income: 8_900,  burn: 8_100  },
  { month: 'Oct',  income: 7_600,  burn: 8_200  },
  { month: 'Nov',  income: 6_200,  burn: 8_250  },
  { month: 'Dec',  income: 9_850,  burn: 8_300  },
  { month: 'Jan',  income: 5_400,  burn: 8_320  },
  { month: 'Feb',  income: 7_130,  burn: 8_340  },
  { month: 'Mar',  income: 10_200, burn: 8_350  },
  { month: 'Apr',  income: 8_450,  burn: 8_360  },
]

const SOURCES = [
  { label: 'Social Media',   pct: 38, color: 'var(--cove-tidal)'    },
  { label: 'Referrals',      pct: 24, color: 'var(--cove-seaglass)' },
  { label: 'Walk-ins',       pct: 18, color: 'var(--cove-seafoam)'  },
  { label: 'Events',         pct: 13, color: 'var(--cove-sand)'     },
  { label: 'Direct Website', pct: 7,  color: 'var(--border-medium)' },
]

// Shelter capacity data
const SHELTER = {
  name:          'Haven House',
  capacity:      18,
  residents:     12,
  costPerChild:  917,   // ~$11,000 / 12
  monthlyIncome: 8_450,
  monthlyBurn:   8_360,
}

const TOP_DONORS = [
  { rank: 1, name: 'Maria Santos',     amount: '$4,500', type: 'Monthly',  since: 'Jan 2024' },
  { rank: 2, name: 'James & Linda Ko', amount: '$3,200', type: 'One-Time', since: 'Mar 2025' },
  { rank: 3, name: 'Anonymous',        amount: '$2,000', type: 'Monthly',  since: 'Jun 2024' },
  { rank: 4, name: 'Grace Fellowship', amount: '$1,800', type: 'One-Time', since: 'Feb 2025' },
  { rank: 5, name: 'Roberto Reyes',    amount: '$1,500', type: 'Monthly',  since: 'Aug 2024' },
]

const RECENT_DONATIONS = [
  { name: 'Maria Santos',     amount: '$375', type: 'Monthly',  source: 'Social Media', date: 'Apr 5, 2025' },
  { name: 'Anonymous',        amount: '$200', type: 'Monthly',  source: 'Referral',     date: 'Apr 4, 2025' },
  { name: 'Trisha Navarro',   amount: '$100', type: 'One-Time', source: 'Walk-in',      date: 'Apr 4, 2025' },
  { name: 'Carlos Mendez',    amount: '$50',  type: 'One-Time', source: 'Social Media', date: 'Apr 3, 2025' },
  { name: 'Roberto Reyes',    amount: '$125', type: 'Monthly',  source: 'Referral',     date: 'Apr 3, 2025' },
  { name: 'Hope Church Fund', amount: '$500', type: 'One-Time', source: 'Event',        date: 'Apr 2, 2025' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(current: number, target: number) {
  return Math.min(100, Math.round((current / target) * 100))
}

function fmtUSD(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

// ─── SVG Line Chart ───────────────────────────────────────────────────────────

const CHART_W = 800
const CHART_H = 220
const PAD = { top: 20, right: 20, bottom: 36, left: 64 }
const innerW = CHART_W - PAD.left - PAD.right
const innerH = CHART_H - PAD.top  - PAD.bottom

const allVals = LINE_CHART_DATA.flatMap(d => [d.income, d.burn])
const yMin = Math.floor(Math.min(...allVals) / 1000) * 1000 - 500
const yMax = Math.ceil(Math.max(...allVals)  / 1000) * 1000 + 500

function xPos(i: number) {
  return PAD.left + (i / (LINE_CHART_DATA.length - 1)) * innerW
}

function yPos(val: number) {
  return PAD.top + innerH - ((val - yMin) / (yMax - yMin)) * innerH
}

function toPolyline(key: 'income' | 'burn') {
  return LINE_CHART_DATA.map((d, i) => `${xPos(i)},${yPos(d[key])}`).join(' ')
}

const Y_TICKS = 5
function yTicks() {
  return Array.from({ length: Y_TICKS + 1 }, (_, i) => yMin + (i / Y_TICKS) * (yMax - yMin))
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DonationReportPage() {
  const available      = SHELTER.capacity - SHELTER.residents
  const currentCost    = SHELTER.residents * SHELTER.costPerChild
  const fullCapCost    = SHELTER.capacity  * SHELTER.costPerChild
  const fundingGap     = fullCapCost - SHELTER.monthlyIncome
  const canAfford      = Math.max(0, Math.floor((SHELTER.monthlyIncome - currentCost) / SHELTER.costPerChild))
  const netThisMonth   = SHELTER.monthlyIncome - SHELTER.monthlyBurn

  return (
    <div className="dr-page">

      {/* ── Header ── */}
      <div className="dr-header">
        <div>
          <h1 className="dr-title">Donation &amp; Contributions Report</h1>
          <p className="dr-subtitle">Staff &amp; Manager View · Data as of April 6, 2025</p>
        </div>
        <span className="dr-badge">Demo Data</span>
      </div>

      {/* ── KPI Cards ── */}
      <div className="dr-kpi-grid">
        {KPI_CARDS.map(card => (
          <div key={card.label} className={`dr-kpi-card dr-kpi-${card.trend}`}>
            <div className="dr-kpi-label">{card.label}</div>
            <div className="dr-kpi-value">{card.value}</div>
            <div className="dr-kpi-sub">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Burn Rate Panel (prominent) ── */}
      <div className="dr-burn-panel">
        <div className="dr-burn-panel-title">Monthly Cash Flow</div>
        <div className="dr-burn-stats">
          <div className="dr-burn-stat dr-burn-in">
            <div className="dr-burn-stat-label">Donations In</div>
            <div className="dr-burn-stat-value">{fmtUSD(SHELTER.monthlyIncome)}</div>
          </div>
          <div className="dr-burn-divider">–</div>
          <div className="dr-burn-stat dr-burn-out">
            <div className="dr-burn-stat-label">Operating Costs</div>
            <div className="dr-burn-stat-value">{fmtUSD(SHELTER.monthlyBurn)}</div>
          </div>
          <div className="dr-burn-divider">=</div>
          <div className={`dr-burn-stat dr-burn-net ${netThisMonth >= 0 ? 'net-pos' : 'net-neg'}`}>
            <div className="dr-burn-stat-label">Net This Month</div>
            <div className="dr-burn-stat-value">
              {netThisMonth >= 0 ? '+' : ''}{fmtUSD(netThisMonth)}
            </div>
          </div>
        </div>
        <p className="dr-burn-panel-note">
          Currently operating at 99% of income. Reaching Essential Operations ($11,000/mo) requires
          an additional <strong>{fmtUSD(11_000 - SHELTER.monthlyIncome)}/mo</strong> in recurring donations.
        </p>
      </div>

      {/* ── Line Chart: Income vs Burn Rate ── */}
      <div className="dr-card">
        <h2 className="dr-card-title">Income vs. Burn Rate — 12-Month Trend</h2>
        <p className="dr-card-sub">Monthly donation income compared to operating costs over time</p>

        <div className="dr-linechart-legend">
          <span className="legend-income">● Income</span>
          <span className="legend-burn">● Burn Rate</span>
        </div>

        <div className="dr-linechart-wrap">
          <svg
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            className="dr-linechart-svg"
            aria-label="Income vs Burn Rate line chart"
          >
            {/* Grid lines */}
            {yTicks().map(tick => (
              <g key={tick}>
                <line
                  x1={PAD.left} y1={yPos(tick)}
                  x2={CHART_W - PAD.right} y2={yPos(tick)}
                  stroke="#dfe8e4" strokeWidth="1"
                />
                <text
                  x={PAD.left - 8} y={yPos(tick) + 4}
                  textAnchor="end" fontSize="11" fill="#8a9f9f"
                >
                  {fmtUSD(tick)}
                </text>
              </g>
            ))}

            {/* Income area fill */}
            <polygon
              points={[
                `${PAD.left},${PAD.top + innerH}`,
                ...LINE_CHART_DATA.map((d, i) => `${xPos(i)},${yPos(d.income)}`),
                `${CHART_W - PAD.right},${PAD.top + innerH}`,
              ].join(' ')}
              fill="rgba(94,158,160,0.1)"
            />

            {/* Burn rate area fill */}
            <polygon
              points={[
                `${PAD.left},${PAD.top + innerH}`,
                ...LINE_CHART_DATA.map((d, i) => `${xPos(i)},${yPos(d.burn)}`),
                `${CHART_W - PAD.right},${PAD.top + innerH}`,
              ].join(' ')}
              fill="rgba(212,164,74,0.1)"
            />

            {/* Income line */}
            <polyline
              points={toPolyline('income')}
              fill="none" stroke="#5e9ea0" strokeWidth="2.5" strokeLinejoin="round"
            />

            {/* Burn rate line */}
            <polyline
              points={toPolyline('burn')}
              fill="none" stroke="#d4a44a" strokeWidth="2.5"
              strokeLinejoin="round" strokeDasharray="6 3"
            />

            {/* Data dots — income */}
            {LINE_CHART_DATA.map((d, i) => (
              <circle key={`in-${i}`} cx={xPos(i)} cy={yPos(d.income)}
                r="4" fill="#5e9ea0" stroke="white" strokeWidth="2" />
            ))}

            {/* Data dots — burn */}
            {LINE_CHART_DATA.map((d, i) => (
              <circle key={`burn-${i}`} cx={xPos(i)} cy={yPos(d.burn)}
                r="4" fill="#d4a44a" stroke="white" strokeWidth="2" />
            ))}

            {/* X-axis labels */}
            {LINE_CHART_DATA.map((d, i) => (
              <text key={d.month} x={xPos(i)} y={CHART_H - 8}
                textAnchor="middle" fontSize="11" fill="#8a9f9f">
                {d.month}
              </text>
            ))}
          </svg>
        </div>
      </div>

      {/* ── Mid grid: Thresholds + Sources ── */}
      <div className="dr-mid-grid">

        <div className="dr-card">
          <h2 className="dr-card-title">Funding Thresholds</h2>
          <p className="dr-card-sub">Progress toward each operational requirement</p>
          <div className="dr-thresholds">
            {THRESHOLDS.map(t => {
              const p = pct(t.current, t.target)
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
                    <span>{fmtUSD(t.current)} raised</span>
                    <span>Goal: {fmtUSD(t.target)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="dr-card">
          <h2 className="dr-card-title">Donor Acquisition Sources</h2>
          <p className="dr-card-sub">Where your donors are coming from</p>
          <div className="dr-sources">
            {SOURCES.map(s => (
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
          </div>
        </div>
      </div>

      {/* ── Shelter Capacity ── */}
      <div className="dr-card">
        <h2 className="dr-card-title">{SHELTER.name} — Shelter Capacity &amp; Impact</h2>
        <p className="dr-card-sub">
          How current occupancy affects monthly burn rate and how many more children can be served
        </p>

        <div className="dr-shelter-grid">

          {/* Occupancy visual */}
          <div className="dr-shelter-occupancy">
            <div className="dr-shelter-occ-label">
              Current Occupancy
              <span className="dr-shelter-occ-count">{SHELTER.residents} / {SHELTER.capacity}</span>
            </div>
            <div className="dr-shelter-beds">
              {Array.from({ length: SHELTER.capacity }, (_, i) => (
                <div
                  key={i}
                  className={`dr-bed ${i < SHELTER.residents ? 'bed-occupied' : 'bed-available'}`}
                  title={i < SHELTER.residents ? 'Occupied' : 'Available'}
                />
              ))}
            </div>
            <div className="dr-shelter-legend">
              <span><span className="dr-bed-dot bed-occupied" /> Occupied ({SHELTER.residents})</span>
              <span><span className="dr-bed-dot bed-available" /> Available ({available})</span>
            </div>
          </div>

          {/* Cost breakdown */}
          <div className="dr-shelter-stats">
            <div className="dr-shelter-stat-row">
              <span>Cost per child / month</span>
              <strong>{fmtUSD(SHELTER.costPerChild)}</strong>
            </div>
            <div className="dr-shelter-stat-row">
              <span>Current monthly need ({SHELTER.residents} children)</span>
              <strong>{fmtUSD(currentCost)}</strong>
            </div>
            <div className="dr-shelter-stat-row">
              <span>Current monthly income</span>
              <strong className="stat-income">{fmtUSD(SHELTER.monthlyIncome)}</strong>
            </div>
            <div className="dr-shelter-stat-row dr-shelter-stat-divider">
              <span>Monthly shortfall from full need</span>
              <strong className="stat-warn">{fmtUSD(currentCost - SHELTER.monthlyIncome)}</strong>
            </div>
            <div className="dr-shelter-stat-row">
              <span>Cost to reach full capacity ({SHELTER.capacity} children)</span>
              <strong>{fmtUSD(fullCapCost)}</strong>
            </div>
            <div className="dr-shelter-stat-row dr-shelter-stat-divider">
              <span>Additional funding needed for full capacity</span>
              <strong className="stat-warn">{fmtUSD(fundingGap)}</strong>
            </div>
          </div>

          {/* Intake callout */}
          <div className="dr-intake-box">
            <div className="dr-intake-number">{canAfford}</div>
            <div className="dr-intake-label">
              additional {canAfford === 1 ? 'child' : 'children'} can be taken in this month
              <span className="dr-intake-sub">
                based on current income surplus above existing residents' costs
              </span>
            </div>
            <div className="dr-intake-detail">
              {available} beds open · {fmtUSD(SHELTER.costPerChild)}/child/mo ·
              Each new admission increases monthly burn by <strong>{fmtUSD(SHELTER.costPerChild)}</strong>
            </div>
          </div>

        </div>
      </div>

      {/* ── Bottom: Top Donors + Recent ── */}
      <div className="dr-bottom-grid">

        <div className="dr-card">
          <h2 className="dr-card-title">Top Donors</h2>
          <p className="dr-card-sub">Ranked by total contribution</p>
          <table className="dr-table">
            <thead>
              <tr>
                <th>#</th><th>Donor</th><th>Total</th><th>Type</th><th>Since</th>
              </tr>
            </thead>
            <tbody>
              {TOP_DONORS.map(d => (
                <tr key={d.rank}>
                  <td>
                    <span className={`dr-rank dr-rank-${d.rank <= 3 ? d.rank : 'other'}`}>{d.rank}</span>
                  </td>
                  <td className="dr-donor-name">{d.name}</td>
                  <td className="dr-amount">{d.amount}</td>
                  <td>
                    <span className={`dr-tag ${d.type === 'Monthly' ? 'tag-monthly' : 'tag-onetime'}`}>
                      {d.type}
                    </span>
                  </td>
                  <td className="dr-muted">{d.since}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="dr-card">
          <h2 className="dr-card-title">Recent Donations</h2>
          <p className="dr-card-sub">Latest activity</p>
          <div className="dr-recent">
            {RECENT_DONATIONS.map((d, i) => (
              <div key={i} className="dr-recent-row">
                <div className="dr-recent-left">
                  <div className="dr-recent-avatar">{d.name[0]}</div>
                  <div>
                    <div className="dr-recent-name">{d.name}</div>
                    <div className="dr-recent-meta">{d.source} · {d.date}</div>
                  </div>
                </div>
                <div className="dr-recent-right">
                  <div className="dr-recent-amount">{d.amount}</div>
                  <span className={`dr-tag ${d.type === 'Monthly' ? 'tag-monthly' : 'tag-onetime'}`}>
                    {d.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
