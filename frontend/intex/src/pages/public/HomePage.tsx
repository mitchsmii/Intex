import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../services/apiService'
// Shelter is served from public/ so the <link rel="preload"> in index.html
// can reference the same stable URL (/shelter.webp) before React renders.
const shelterImg = '/shelter.webp'
import handsImg from '../../assets/hands.webp'
import girlsJumpingFieldImg from '../../assets/girls-jumping-field.webp'
import './HomePage.css'

const pillars = [
  {
    title: 'Safety',
    description:
      'We create secure environments where survivors can find refuge from harm. Every person who enters our doors is protected, respected, and free from fear.',
  },
  {
    title: 'Healing',
    description:
      'Trauma-informed care guides every interaction. We walk alongside survivors through their healing journey with compassion, patience, and evidence-based support.',
  },
  {
    title: 'Justice',
    description:
      'Every survivor deserves to be heard and validated. We advocate for accountability, access to legal resources, and systemic change that protects the vulnerable.',
  },
  {
    title: 'Empowerment',
    description:
      'We transform trauma into leadership. Survivors rebuild confidence, develop skills, and emerge as advocates who strengthen their communities.',
  },
]



function HomePage() {
  const [totalServed, setTotalServed] = useState(0)
  const [activeSafehouses, setActiveSafehouses] = useState(0)
  const [totalRaised, setTotalRaised] = useState(0)

  useEffect(() => {
    api.getResidentPublicCounts().then(c => setTotalServed(c.totalServed))
    api.getSafehouses().then(s => setActiveSafehouses(s.filter(h => h.status === 'Active').length))
    api.getDonationsTotal().then(({ total }) => setTotalRaised(Number(total)))
  }, [])

  return (
    <>
      {/* ── Hero ── */}
      <section className="hp-hero" aria-label="Hero">
        {/* Real <img> so the browser can paint it as soon as bytes arrive,
            matching the /shelter.webp preload hint in index.html */}
        <img
          src={shelterImg}
          alt=""
          aria-hidden="true"
          className="hp-hero-bg-img"
          fetchPriority="high"
          width="2816"
          height="1536"
        />
        <div className="hp-hero-overlay">
          <div className="hp-hero-content">
            <p className="hp-hero-eyebrow">Safety · Healing · Justice · Empowerment</p>
            <h1 className="hp-hero-title">Cove</h1>
            <p className="hp-hero-tagline">A Sanctuary for Survivors</p>
            <p className="hp-hero-sub">
              We provide a safe haven where individuals can rebuild their lives
              and transform trauma into leadership — seen, heard, and loved like family.
            </p>
            <Link to="/donate" className="hp-btn-primary">Donate Now</Link>
          </div>
        </div>
      </section>

      {/* ── Holistic Needs ── */}
      <section className="hp-holistic">
        <div className="hp-holistic-inner">
          <div className="hp-holistic-content">
            <h2>Comprehensive Care for Whole-Person Healing</h2>
            <p className="hp-holistic-intro">
              True healing addresses every dimension of a person's life.
              Our holistic approach meets survivors where they are and walks
              with them every step of the way.
            </p>
          </div>
          <div className="hp-holistic-img">
            <img src={handsImg} alt="Hands reaching out in support" fetchPriority="high" width="2650" height="1450" />
          </div>
        </div>
      </section>

      {/* ── Four Pillars ── */}
      <section className="hp-pillars">
        <div className="hp-section-header">
          <h2>What We Do</h2>
          <p>
            From victimhood to empowerment — our four pillars guide every
            survivor's journey toward a new life.
          </p>
        </div>
        <div className="hp-pillars-grid">
          {pillars.map((p) => (
            <div key={p.title} className="hp-pillar-card">
              <h3>{p.title}</h3>
              <p>{p.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Impact Banner ── */}
      <section className="hp-impact-banner">
        <div className="hp-impact-inner">
          <div className="hp-impact-image">
            <img src={girlsJumpingFieldImg} alt="Girls jumping in a field" loading="lazy" />
          </div>
          <div className="hp-impact-content">
            <div className="hp-impact-text">
              <p className="hp-impact-eyebrow">Transparency &amp; Trust</p>
              <h2>See the Real Impact</h2>
              <p>
                Curious where your donation goes? View our live impact dashboard —
                real numbers, real outcomes, updated from our case management system.
              </p>
            </div>
            <div className="hp-impact-stats" aria-label="Impact highlights">
              <div className="hp-impact-stat">
                <p className="hp-impact-stat-value">{totalServed}+</p>
                <p className="hp-impact-stat-label">Survivors Served</p>
              </div>
              <div className="hp-impact-stat">
                <p className="hp-impact-stat-value">{activeSafehouses}</p>
                <p className="hp-impact-stat-label">Active Safe Homes</p>
              </div>
              <div className="hp-impact-stat">
                <p className="hp-impact-stat-value">${totalRaised.toLocaleString()}</p>
                <p className="hp-impact-stat-label">Total Raised</p>
              </div>
            </div>
            <div className="hp-impact-cta-row">
              <Link to="/impact" className="hp-btn-secondary">View Our Impact</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Mission Banner ── */}
      <section className="hp-mission">
        <div className="hp-mission-inner">
          <p className="hp-mission-label">Our Mission</p>
          <blockquote className="hp-mission-text">
            "Our mission is to provide a sanctuary of safety, healing, and
            empowerment for survivors of abuse. We offer a safe haven where
            individuals can rebuild their lives and transform trauma into
            leadership. Here, survivors become part of a community where every
            person is seen, heard, and loved like family."
          </blockquote>
        </div>
      </section>
    </>
  )
}

export default HomePage
