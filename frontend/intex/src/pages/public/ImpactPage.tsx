import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../services/apiService'
import type { SafehouseMonthlyMetric, Safehouse } from '../../services/apiService'
import shelterImg    from '../../assets/shelter.webp'
import kidsJumping   from '../../assets/kids-jumping.png'
import kidsCircle    from '../../assets/kids-circle.png'
import girlsHandsRaised from '../../assets/girls-hands-raised.png'
import './ImpactPage.css'

// ─── Animated counter ────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1400) {
  const [value, setValue] = useState(0)
  const start = useRef<number | null>(null)
  const raf   = useRef<number>(0)

  useEffect(() => {
    if (target === 0) return
    start.current = null
    const step = (ts: number) => {
      if (start.current === null) start.current = ts
      const prog = Math.min((ts - start.current) / duration, 1)
      const ease = 1 - Math.pow(1 - prog, 3)
      setValue(Math.round(ease * target))
      if (prog < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])

  return value
}

function StatNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const animated = useCountUp(value)
  return <span>{animated.toLocaleString()}{suffix}</span>
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ImpactPage() {
  const [safehouses, setSafehouses] = useState<Safehouse[]>([])
  const [metrics,    setMetrics]    = useState<SafehouseMonthlyMetric[]>([])
  const [totalRaised, setTotalRaised] = useState(0)
  const [activeResidents, setActiveResidents]  = useState(0)
  const [reintegrated,    setReintegrated]     = useState(0)
  const [totalServed,     setTotalServed]       = useState(0)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    Promise.allSettled([
      api.getSafehouses().then(setSafehouses),
      api.getResidentPublicCounts().then(counts => {
        setActiveResidents(counts.activeResidents)
        setReintegrated(counts.reintegrated)
        setTotalServed(counts.totalServed)
      }),
      api.getLatestMetrics().then(setMetrics),
      api.getDonationsTotal().then(({ total }) => setTotalRaised(Number(total))),
    ])
  }, [])

  const activeSafehouses = safehouses.filter(s => s.status === 'Active').length

  const avgHealth = metrics.filter(m => m.avgHealthScore != null).length
    ? metrics.reduce((s, m) => s + Number(m.avgHealthScore ?? 0), 0) / metrics.filter(m => m.avgHealthScore != null).length
    : 0
  const avgEdu = metrics.filter(m => m.avgEducationProgress != null).length
    ? metrics.reduce((s, m) => s + Number(m.avgEducationProgress ?? 0), 0) / metrics.filter(m => m.avgEducationProgress != null).length
    : 0

  const goalUSD = 100_000
  const goalPct = Math.min(100, Math.round((totalRaised / goalUSD) * 100))

  const IMPACT_TIERS = [
    { amount: '₱850/mo',   label: 'provides essential vitamins for a child in care' },
    { amount: '₱2,825/mo', label: "covers a child's monthly food expenses" },
    { amount: '₱5,650/mo', label: 'funds medical, dental, and educational services' },
    { amount: '₱16,950/mo',label: 'employs professional caregiving staff' },
    { amount: '₱84,750/mo',label: 'covers the mortgage that keeps children sheltered' },
  ]

  return (
    <div className="ip-page">

      {/* ── Hero ── */}
      <section className="ip-hero" style={{ backgroundImage: `url(${shelterImg})` }}>
        <div className="ip-hero-overlay">
          <div className="ip-hero-inner">
            <p className="ip-hero-eyebrow">Transparency · Trust · Impact</p>
            <h1 className="ip-hero-title">See Your Impact</h1>
            <p className="ip-hero-sub">
              Every contribution moves lives forward. Here's a real-time look at
              what the Lighthouse Sanctuary community has achieved together — and
              how far we still have to go.
            </p>
            <div className="ip-hero-actions">
              <Link to="/donate" className="hp-btn-primary">Donate Now</Link>
              <a href="#impact-numbers" className="ip-btn-ghost">See the Numbers</a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Big numbers ── */}
      <section className="ip-stats-section" id="impact-numbers">
        <div className="ip-section-inner">
          <div className="ip-section-label">Our Reach</div>
          <h2 className="ip-section-title">Lives Transformed</h2>
          <p className="ip-section-sub">
            Aggregated and anonymized — real data from our case management system.
          </p>

          <div className="ip-stats-grid">
            {[
              {
                value: totalServed, suffix: '+',
                label: 'Survivors Served',
                sub: 'total residents in our care',
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                ),
              },
              {
                value: activeResidents, suffix: '',
                label: 'Currently in Care',
                sub: 'active residents today',
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                ),
              },
              {
                value: reintegrated, suffix: '',
                label: 'Reintegrated',
                sub: 'survivors returned to family or community',
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                ),
              },
              {
                value: activeSafehouses, suffix: '',
                label: 'Active Safehouses',
                sub: 'Providing safety and care across the Philippines',
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                  </svg>
                ),
              },
            ].map(s => (
              <div key={s.label} className="ip-stat-card">
                <div className="ip-stat-icon">{s.icon}</div>
                <div className="ip-stat-number">
                  <StatNumber value={s.value} suffix={s.suffix} />
                </div>
                <div className="ip-stat-label">{s.label}</div>
                <div className="ip-stat-sub">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Photo break 1 ── */}
      <section className="ip-photo-break">
        <div className="ip-photo-break-inner">
          <div className="ip-photo-break-text">
            <p className="ip-section-label">Their Stories</p>
            <h2>Behind Every Number<br/>Is a Life Reclaimed</h2>
            <p>The girls in our care arrive broken. They leave with dignity, skills, and hope — supported every step of the way by our dedicated team.</p>
          </div>
          <div className="ip-photo-break-img-wrap">
            {/* Replace src with girls-together image when ready */}
            <img src={kidsJumping} alt="Girls celebrating together" className="ip-photo-break-img" />
          </div>
        </div>
      </section>

      {/* ── Outcomes ── */}
      <section className="ip-outcomes-section">
        <div className="ip-section-inner">
          <div className="ip-section-label">Healing in Progress</div>
          <h2 className="ip-section-title">Resident Outcomes</h2>
          <p className="ip-section-sub">
            Progress is measured across health and education for every resident in our program.
          </p>

          <div className="ip-outcomes-grid">

            {/* Active Safehouses */}
            <div className="ip-outcome-card">
              <div className="ip-outcome-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                <h3>Active Safehouses</h3>
              </div>
              <div className="ip-outcome-number">{activeSafehouses}<span className="ip-outcome-unit"> locations</span></div>
              <div className="ip-outcome-bar-track">
                <div className="ip-outcome-bar-fill" style={{ width: '100%' }} />
              </div>
              <p className="ip-outcome-desc">Each safehouse provides a secure environment where survivors can heal and rebuild their lives.</p>
            </div>

            {/* Health */}
            <div className="ip-outcome-card">
              <div className="ip-outcome-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
                <h3>Average Health Score</h3>
              </div>
              <div className="ip-outcome-number">
                {avgHealth > 0 ? avgHealth.toFixed(1) : '—'}<span className="ip-outcome-unit"> / 5</span>
              </div>
              <div className="ip-outcome-bar-track">
                <div className="ip-outcome-bar-fill ip-bar-health" style={{ width: `${avgHealth > 0 ? (avgHealth / 5) * 100 : 0}%` }} />
              </div>
              <p className="ip-outcome-desc">Assessed across psychosocial, physical, and emotional dimensions of each resident's wellbeing.</p>
            </div>

            {/* Education */}
            <div className="ip-outcome-card">
              <div className="ip-outcome-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
                <h3>Education Progress</h3>
              </div>
              <div className="ip-outcome-number">
                {avgEdu > 0 ? Math.round(avgEdu) : '—'}<span className="ip-outcome-unit">%</span>
              </div>
              <div className="ip-outcome-bar-track">
                <div className="ip-outcome-bar-fill ip-bar-edu" style={{ width: `${avgEdu > 0 ? avgEdu : 0}%` }} />
              </div>
              <p className="ip-outcome-desc">Average educational milestone progress tracked monthly — from literacy to vocational certification.</p>
            </div>

          </div>
        </div>
      </section>

      {/* ── Fundraising ── */}
      <section className="ip-fund-section">
        <div className="ip-section-inner">
          <div className="ip-section-label ip-label-light">Fundraising</div>
          <h2 className="ip-section-title ip-title-light">Shelter Expansion Goal</h2>
          <p className="ip-section-sub ip-sub-light">
            We're working toward opening a second shelter — 18 additional beds for survivors in need.
          </p>

          <div className="ip-fund-card">
            <div className="ip-fund-numbers">
              <div>
                <div className="ip-fund-raised">₱{totalRaised.toLocaleString()}</div>
                <div className="ip-fund-label">raised so far</div>
              </div>
              <div className="ip-fund-goal">
                <div className="ip-fund-goal-num">₱{(goalUSD * 56.5).toLocaleString()}</div>
                <div className="ip-fund-label">goal</div>
              </div>
            </div>
            <div className="ip-fund-track">
              <div className="ip-fund-fill" style={{ width: `${goalPct}%` }} />
            </div>
            <div className="ip-fund-meta">
              <span className="ip-fund-pct">{goalPct}% funded</span>
              <span className="ip-fund-quote">"Together, we go further."</span>
            </div>

            <div className="ip-fund-photos">
              <div className="ip-fund-photo-wrap ip-photo-wide">
                <img src={kidsJumping} alt="Children jumping together in a field" className="ip-fund-photo" />
                <div className="ip-photo-caption">Joy restored — children in our care</div>
              </div>
              <div className="ip-fund-photo-wrap ip-photo-narrow">
                <img src={kidsCircle} alt="Children sitting together in a circle" className="ip-fund-photo" />
                <div className="ip-photo-caption">Community &amp; belonging</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How your gift helps ── */}
      <section className="ip-tiers-section">
        <div className="ip-section-inner">
          <div className="ip-section-label">What You Make Possible</div>
          <h2 className="ip-section-title">Your Monthly Gift in Action</h2>
          <p className="ip-section-sub">
            Every peso goes directly to the children. See exactly where your contribution goes.
          </p>

          <div className="ip-tiers-grid">
            {IMPACT_TIERS.map((t, i) => (
              <div key={i} className="ip-tier-card">
                <div className="ip-tier-amount">{t.amount}</div>
                <div className="ip-tier-label">{t.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Photo break 2 ── */}
      <section className="ip-photo-full">
        <img src={girlsHandsRaised} alt="Girls with hands raised together in front of a Philippine church" className="ip-photo-full-img" />
        <div className="ip-photo-full-overlay">
          <p className="ip-photo-full-quote">"Every child deserves safety, healing, and a future."</p>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="ip-cta-section">
        <div className="ip-cta-inner">
          <h2>Ready to make a difference?</h2>
          <p>
            Your gift — no matter the size — directly funds shelter, healing, and a brighter future
            for survivors of abuse and trafficking in the Philippines.
          </p>
          <div className="ip-cta-actions">
            <Link to="/donate" className="hp-btn-primary">Donate Now</Link>
            <Link to="/" className="ip-btn-ghost ip-btn-ghost-dark">Back to Home</Link>
          </div>
          <p className="ip-cta-note">
            Lighthouse Sanctuary · 501(c)(3) nonprofit · EIN: 81-3220618 · Tax-deductible to the full extent of the law.
          </p>
        </div>
      </section>

    </div>
  )
}
