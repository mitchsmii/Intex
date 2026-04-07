import { useState } from 'react'
import type { ReactNode } from 'react'
import { api } from '../../services/apiService'
import type { Supporter, DonationRaw } from '../../services/apiService'
import './DonationHistoryPage.css'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtAmount(amount: number | null, currency: string | null) {
  if (amount == null) return '—'
  if (currency === 'USD') {
    return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  }
  return '₱' + amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function memberSince(createdAt: string | null, donations: DonationRaw[]) {
  const dates = [
    createdAt ? new Date(createdAt) : null,
    ...donations.filter(d => d.donationDate).map(d => new Date(d.donationDate!)),
  ].filter(Boolean) as Date[]
  if (dates.length === 0) return '—'
  const earliest = new Date(Math.min(...dates.map(d => d.getTime())))
  return earliest.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function donationTier(total: number) {
  if (total >= 2000) return 'Champion'
  if (total >= 750)  return 'Advocate'
  if (total >= 250)  return 'Supporter'
  return 'Friend'
}

function givingStreak(donations: DonationRaw[]) {
  const monthlySorted = donations
    .filter(d => d.isRecurring && d.donationDate)
    .map(d => {
      const dt = new Date(d.donationDate!)
      return { year: dt.getFullYear(), month: dt.getMonth() + 1 }
    })
    .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month)

  if (monthlySorted.length === 0) return 0
  let streak = 1
  for (let i = 1; i < monthlySorted.length; i++) {
    const prev = monthlySorted[i - 1]
    const curr = monthlySorted[i]
    const prevDate = new Date(prev.year, prev.month - 1)
    const currDate = new Date(curr.year, curr.month - 1)
    const diffMonths = (prevDate.getFullYear() - currDate.getFullYear()) * 12 + (prevDate.getMonth() - currDate.getMonth())
    if (diffMonths === 1) streak++
    else break
  }
  return streak
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
  Champion:  'tier-champion',
  Advocate:  'tier-advocate',
  Supporter: 'tier-supporter',
  Friend:    'tier-friend',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DonationHistoryPage() {
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [supporter, setSupporter] = useState<Supporter | null>(null)
  const [donations, setDonations] = useState<DonationRaw[]>([])
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [searched,  setSearched]  = useState(false)

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSearched(true)
    try {
      const found = await api.lookupSupporter(firstName.trim(), lastName.trim(), email.trim())
      const donationList = await api.getDonationsBySupporter(found.supporterId)
      setSupporter(found)
      setDonations(donationList)
    } catch {
      setSupporter(null)
      setDonations([])
      setError('No donation record found for that name and email. Please check your details and try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setSupporter(null)
    setDonations([])
    setFirstName('')
    setLastName('')
    setEmail('')
    setError('')
    setSearched(false)
  }

  const totalUSD  = donations.reduce((s, d) => s + (d.amount ?? 0), 0)
  const currency  = donations[0]?.currency ?? 'PHP'
  const tier      = donationTier(totalUSD)
  const streak    = givingStreak(donations)
  const since     = supporter ? memberSince(supporter.createdAt, donations) : '—'
  const impact    = supporter ? calcImpact(totalUSD) : []
  const sorted    = [...donations].sort((a, b) => {
    if (!a.donationDate) return 1
    if (!b.donationDate) return -1
    return new Date(b.donationDate).getTime() - new Date(a.donationDate).getTime()
  })

  return (
    <div className="dh-page">

      {/* ── Lookup form ── */}
      {!supporter && (
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
                  <label htmlFor="dh-first">First Name</label>
                  <input
                    id="dh-first"
                    type="text"
                    placeholder="e.g. Byron"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="dh-last">Last Name</label>
                  <input
                    id="dh-last"
                    type="text"
                    placeholder="e.g. Jones"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    required
                  />
                </div>
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
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              {searched && error && (
                <div className="dh-error">{error}</div>
              )}

              <button type="submit" className="dh-lookup-btn" disabled={loading}>
                {loading ? 'Looking up…' : 'Find My Donations'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Donor results ── */}
      {supporter && (
        <>
          {/* Hero card */}
          <div className="dh-hero">
            <div className="dh-hero-left">
              <div className="dh-avatar">
                {(supporter.firstName?.[0] ?? '?')}{(supporter.lastName?.[0] ?? '')}
              </div>
              <div>
                <div className="dh-hero-name">{supporter.firstName} {supporter.lastName}</div>
                <div className="dh-hero-email">{supporter.email}</div>
                <div className="dh-hero-meta">
                  <span>Member since {since}</span>
                  {streak > 0 && (
                    <>
                      <span className="dh-dot">·</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        {streak}-month giving streak
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                        </svg>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="dh-hero-right">
              <div className={`dh-tier ${TIER_COLORS[tier] ?? ''}`}>{tier} Donor</div>
              <div className="dh-total-label">Total Contributed</div>
              <div className="dh-total-value">{fmtAmount(totalUSD, currency)}</div>
              <button className="dh-back-btn" onClick={handleReset}>← Look up another donor</button>
            </div>
          </div>

          {/* Impact section */}
          {totalUSD > 0 && (
            <>
              <div className="dh-section-title">
                <h2>Your Impact</h2>
                <p>Here's what your {fmtAmount(totalUSD, currency)} in donations has made possible</p>
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
            </>
          )}

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
                Your generous giving since {since} has helped Lighthouse Sanctuary
                provide refuge, rehabilitation, and reintegration services to survivors of abuse
                and trafficking. Because of donors like you, children have a safe place to heal
                and a future full of hope.
              </p>
              <div className="dh-lives-stats">
                <div className="dh-lives-stat">
                  <strong>{donations.filter(d => d.isRecurring).length}</strong>
                  <span>recurring payments made</span>
                </div>
                <div className="dh-lives-stat">
                  <strong>{donations.filter(d => !d.isRecurring).length}</strong>
                  <span>one-time gifts</span>
                </div>
                <div className="dh-lives-stat">
                  <strong>
                    {donations.length > 0
                      ? fmtAmount(Math.max(...donations.map(d => d.amount ?? 0)), currency)
                      : '—'}
                  </strong>
                  <span>largest single gift</span>
                </div>
              </div>
            </div>
          </div>

          {/* Donation history table */}
          <div className="dh-section-title">
            <h2>Donation History</h2>
            <p>{donations.length} total donation{donations.length !== 1 ? 's' : ''} — most recent first</p>
          </div>

          <div className="dh-card">
            <table className="dh-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Type</th>
                  <th>Method</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(d => (
                  <tr key={d.donationId}>
                    <td className="dh-td-date">{fmtDate(d.donationDate)}</td>
                    <td className="dh-td-amount">{fmtAmount(d.amount, d.currency)}</td>
                    <td>
                      <span className={`dh-tag ${d.isRecurring ? 'tag-monthly' : 'tag-onetime'}`}>
                        {d.isRecurring ? 'Monthly' : 'One-Time'}
                      </span>
                    </td>
                    <td className="dh-td-source">{d.paymentMethod ?? '—'}</td>
                    <td>
                      <span className="dh-tag tag-complete">✓ Complete</span>
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ color: 'var(--text-muted)', padding: '0.75rem' }}>
                      No donations found for this supporter.
                    </td>
                  </tr>
                )}
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
