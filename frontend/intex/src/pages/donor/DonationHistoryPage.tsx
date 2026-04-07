import { useState } from 'react'
import type { ReactNode } from 'react'
import './DonationHistoryPage.css'

// ─── Test donor record ────────────────────────────────────────────────────────

const DONOR_DB: Record<string, DonorRecord> = {
  'byron|byronwj@byu.edu': {
    firstName:   'Byron',
    lastName:    'Jones',
    email:       'byronwj@byu.edu',
    memberSince: 'January 2024',
    tier:        'Champion',
    totalUSD:    2_250,
    streak:      16, // months of consecutive giving
    donations: [
      { id: 1,  date: 'Jan 15, 2024', amount: 500,  type: 'One-Time', frequency: null,     source: 'Social Media', currency: 'USD' },
      { id: 2,  date: 'Feb 1, 2024',  amount: 100,  type: 'Monthly',  frequency: 'Start',  source: 'Referral',     currency: 'USD' },
      { id: 3,  date: 'Mar 1, 2024',  amount: 100,  type: 'Monthly',  frequency: null,     source: 'Auto',         currency: 'USD' },
      { id: 4,  date: 'Apr 1, 2024',  amount: 100,  type: 'Monthly',  frequency: null,     source: 'Auto',         currency: 'USD' },
      { id: 5,  date: 'May 1, 2024',  amount: 100,  type: 'Monthly',  frequency: null,     source: 'Auto',         currency: 'USD' },
      { id: 6,  date: 'Jun 1, 2024',  amount: 100,  type: 'Monthly',  frequency: null,     source: 'Auto',         currency: 'USD' },
      { id: 7,  date: 'Jul 1, 2024',  amount: 100,  type: 'Monthly',  frequency: null,     source: 'Auto',         currency: 'USD' },
      { id: 8,  date: 'Aug 1, 2024',  amount: 100,  type: 'Monthly',  frequency: null,     source: 'Auto',         currency: 'USD' },
      { id: 9,  date: 'Sep 5, 2024',  amount: 250,  type: 'One-Time', frequency: null,     source: 'Event',        currency: 'USD' },
      { id: 10, date: 'Sep 1, 2024',  amount: 100,  type: 'Monthly',  frequency: null,     source: 'Auto',         currency: 'USD' },
      { id: 11, date: 'Oct 1, 2024',  amount: 100,  type: 'Monthly',  frequency: null,     source: 'Auto',         currency: 'USD' },
      { id: 12, date: 'Nov 1, 2024',  amount: 100,  type: 'Monthly',  frequency: null,     source: 'Auto',         currency: 'USD' },
      { id: 13, date: 'Dec 1, 2024',  amount: 100,  type: 'Monthly',  frequency: null,     source: 'Auto',         currency: 'USD' },
      { id: 14, date: 'Dec 20, 2024', amount: 300,  type: 'One-Time', frequency: null,     source: 'Direct',       currency: 'USD' },
      { id: 15, date: 'Jan 1, 2025',  amount: 100,  type: 'Monthly',  frequency: null,     source: 'Auto',         currency: 'USD' },
      { id: 16, date: 'Feb 1, 2025',  amount: 100,  type: 'Monthly',  frequency: null,     source: 'Auto',         currency: 'USD' },
      { id: 17, date: 'Mar 1, 2025',  amount: 100,  type: 'Monthly',  frequency: null,     source: 'Auto',         currency: 'USD' },
      { id: 18, date: 'Apr 1, 2025',  amount: 100,  type: 'Monthly',  frequency: null,     source: 'Auto',         currency: 'USD' },
    ],
  },
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Donation {
  id: number
  date: string
  amount: number
  type: 'One-Time' | 'Monthly'
  frequency: 'Start' | null
  source: string
  currency: string
}

interface DonorRecord {
  firstName: string
  lastName: string
  email: string
  memberSince: string
  tier: string
  totalUSD: number
  streak: number
  donations: Donation[]
}

// ─── Impact calculations ──────────────────────────────────────────────────────

function calcImpact(total: number): { icon: ReactNode; value: number; unit: string; label: string; color: string }[] {
  return [
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11l19-9-9 19-2-8-8-2z"/>
        </svg>
      ),
      value: Math.floor(total / 50),
      unit: 'months',
      label: 'of nutritious meals provided',
      color: 'impact-teal',
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
      ),
      value: Math.floor(total / 15),
      unit: 'months',
      label: 'of vitamins & health supplements',
      color: 'impact-green',
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
      ),
      value: Math.floor(total / 100),
      unit: 'months',
      label: 'of medical, dental & education funded',
      color: 'impact-sand',
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      ),
      value: Math.max(1, Math.floor(total / 600)),
      unit: total / 600 >= 2 ? 'children' : 'child',
      label: 'directly supported for 6 months',
      color: 'impact-deep',
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
      value: Math.floor(total / 1500),
      unit: 'months',
      label: 'of shelter costs covered',
      color: 'impact-teal',
    },
  ]
}

const TIER_COLORS: Record<string, string> = {
  Champion:    'tier-champion',
  Advocate:    'tier-advocate',
  Supporter:   'tier-supporter',
  Friend:      'tier-friend',
}

function fmtUSD(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DonationHistoryPage() {
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [donor, setDonor]     = useState<DonorRecord | null>(null)
  const [error, setError]     = useState('')
  const [searched, setSearched] = useState(false)

  function handleLookup(e: React.FormEvent) {
    e.preventDefault()
    const key = `${name.trim().toLowerCase()}|${email.trim().toLowerCase()}`
    const match = DONOR_DB[key]
    if (match) {
      setDonor(match)
      setError('')
    } else {
      setDonor(null)
      setError('No donation record found for that name and email. Please check your details and try again.')
    }
    setSearched(true)
  }

  function handleReset() {
    setDonor(null)
    setName('')
    setEmail('')
    setError('')
    setSearched(false)
  }

  const impact = donor ? calcImpact(donor.totalUSD) : []
  const sorted = donor ? [...donor.donations].sort((a, b) => b.id - a.id) : []

  return (
    <div className="dh-page">

      {/* ── Lookup form ── */}
      {!donor && (
        <div className="dh-lookup-wrap">
          <div className="dh-lookup-card">
            <div className="dh-lookup-icon">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--cove-tidal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                <line x1="9" y1="12" x2="15" y2="12"/>
                <line x1="9" y1="16" x2="13" y2="16"/>
              </svg>
            </div>
            <h1 className="dh-lookup-title">View Your Donation History</h1>
            <p className="dh-lookup-sub">
              Enter the name and email you used when donating to see your giving history
              and the impact you've made.
            </p>

            <form className="dh-lookup-form" onSubmit={handleLookup}>
              <div className="dh-lookup-fields">
                <div>
                  <label htmlFor="dh-name">First Name</label>
                  <input
                    id="dh-name"
                    type="text"
                    placeholder="e.g. Byron"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="dh-email">Email Address</label>
                  <input
                    id="dh-email"
                    type="email"
                    placeholder="e.g. you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {searched && error && (
                <div className="dh-error">{error}</div>
              )}

              <button type="submit" className="dh-lookup-btn">Find My Donations</button>
            </form>
          </div>
        </div>
      )}

      {/* ── Donor results ── */}
      {donor && (
        <>
          {/* Hero card */}
          <div className="dh-hero">
            <div className="dh-hero-left">
              <div className="dh-avatar">
                {donor.firstName[0]}{donor.lastName[0]}
              </div>
              <div>
                <div className="dh-hero-name">{donor.firstName} {donor.lastName}</div>
                <div className="dh-hero-email">{donor.email}</div>
                <div className="dh-hero-meta">
                  <span>Member since {donor.memberSince}</span>
                  <span className="dh-dot">·</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    {donor.streak}-month giving streak
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                    </svg>
                  </span>
                </div>
              </div>
            </div>
            <div className="dh-hero-right">
              <div className={`dh-tier ${TIER_COLORS[donor.tier] ?? ''}`}>
                {donor.tier} Donor
              </div>
              <div className="dh-total-label">Total Contributed</div>
              <div className="dh-total-value">{fmtUSD(donor.totalUSD)}</div>
              <button className="dh-back-btn" onClick={handleReset}>← Look up another donor</button>
            </div>
          </div>

          {/* Impact section */}
          <div className="dh-section-title">
            <h2>Your Impact</h2>
            <p>Here's what your {fmtUSD(donor.totalUSD)} in donations has made possible</p>
          </div>

          <div className="dh-impact-grid">
            {impact.map(item => (
              <div key={item.label} className={`dh-impact-card ${item.color}`}>
                <div className="dh-impact-icon">{item.icon}</div>
                <div className="dh-impact-value">{item.value}</div>
                <div className="dh-impact-unit">{item.unit}</div>
                <div className="dh-impact-label">{item.label}</div>
              </div>
            ))}
          </div>

          {/* Lives changed callout */}
          <div className="dh-lives-card">
            <div className="dh-lives-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--cove-tidal)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </div>
            <div className="dh-lives-content">
              <div className="dh-lives-title">Lives Changed</div>
              <p className="dh-lives-text">
                Your consistent giving since {donor.memberSince} has helped Lighthouse Sanctuary
                provide refuge, rehabilitation, and reintegration services to survivors of abuse
                and trafficking. Because of donors like you, children have a safe place to heal
                and a future full of hope.
              </p>
              <div className="dh-lives-stats">
                <div className="dh-lives-stat">
                  <strong>{donor.donations.filter(d => d.type === 'Monthly').length}</strong>
                  <span>recurring payments made</span>
                </div>
                <div className="dh-lives-stat">
                  <strong>{donor.donations.filter(d => d.type === 'One-Time').length}</strong>
                  <span>one-time gifts</span>
                </div>
                <div className="dh-lives-stat">
                  <strong>{fmtUSD(Math.max(...donor.donations.map(d => d.amount)))}</strong>
                  <span>largest single gift</span>
                </div>
              </div>
            </div>
          </div>

          {/* Donation history table */}
          <div className="dh-section-title">
            <h2>Donation History</h2>
            <p>{donor.donations.length} total donations — most recent first</p>
          </div>

          <div className="dh-card">
            <table className="dh-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Type</th>
                  <th>Source</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(d => (
                  <tr key={d.id}>
                    <td className="dh-td-date">{d.date}</td>
                    <td className="dh-td-amount">{fmtUSD(d.amount)}</td>
                    <td>
                      <span className={`dh-tag ${d.type === 'Monthly' ? 'tag-monthly' : 'tag-onetime'}`}>
                        {d.type}
                      </span>
                    </td>
                    <td className="dh-td-source">{d.source}</td>
                    <td>
                      <span className="dh-tag tag-complete">✓ Complete</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="dh-tax-note">
            Lighthouse Sanctuary is a registered 501(c)(3) nonprofit · EIN: 81-3220618 ·
            All donations are tax-deductible. For official tax receipts contact Info@LighthouseSanctuary.org.
          </p>
        </>
      )}
    </div>
  )
}
