import { Link } from 'react-router-dom'
import shelterImg from '../../assets/shelter.png'
import handsImg from '../../assets/hands.png'
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


const CAMPAIGN_GOAL = 25000
const CAMPAIGN_RAISED = 12450
const CAMPAIGN_PCT = Math.round((CAMPAIGN_RAISED / CAMPAIGN_GOAL) * 100)

function HomePage() {
  return (
    <>
      {/* ── Hero ── */}
      <section
        className="hp-hero"
        style={{ backgroundImage: `url(${shelterImg})` }}
        aria-label="Hero"
      >
        <div className="hp-hero-overlay">
          <div className="hp-hero-content">
            <p className="hp-hero-eyebrow">Safety · Healing · Justice · Empowerment</p>
            <h1 className="hp-hero-title">A Sanctuary for Survivors</h1>
            <p className="hp-hero-sub">
              We provide a safe haven where individuals can rebuild their lives
              and transform trauma into leadership — seen, heard, and loved like family.
            </p>
            <Link to="/donate" className="hp-btn-primary">Donate Now</Link>
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

      {/* ── Holistic Needs ── */}
      <section className="hp-holistic">
        <div className="hp-holistic-inner">
          <div className="hp-holistic-img">
            <img src={handsImg} alt="Hands reaching out in support" />
          </div>
          <div className="hp-holistic-content">
            <h2>Comprehensive Care for Whole-Person Healing</h2>
            <p className="hp-holistic-intro">
              True healing addresses every dimension of a person's life.
              Our holistic approach meets survivors where they are and walks
              with them every step of the way.
            </p>
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
          <p className="hp-mission-motto">Family · Progress · Holistic Love</p>
        </div>
      </section>

      {/* ── Active Campaign ── */}
      <section className="hp-campaign">
        <div className="hp-campaign-inner">
          <span className="hp-campaign-badge">Active Campaign</span>
          <h2>Wheels of Hope</h2>
          <p>
            Transportation is a critical barrier for survivors escaping dangerous
            situations. Help us provide reliable vehicles for our outreach team
            and safe transit for those who need it most.
          </p>
          <div className="hp-progress-wrap">
            <div className="hp-progress-labels">
              <span>${CAMPAIGN_RAISED.toLocaleString()} raised</span>
              <span>Goal: ${CAMPAIGN_GOAL.toLocaleString()}</span>
            </div>
            <div className="hp-progress-bar" role="progressbar" aria-valuenow={CAMPAIGN_PCT} aria-valuemin={0} aria-valuemax={100}>
              <div className="hp-progress-fill" style={{ width: `${CAMPAIGN_PCT}%` }} />
            </div>
            <p className="hp-progress-pct">{CAMPAIGN_PCT}% funded</p>
          </div>
          <Link to="/donate" className="hp-btn-secondary">Support This Campaign</Link>
        </div>
      </section>
    </>
  )
}

export default HomePage
