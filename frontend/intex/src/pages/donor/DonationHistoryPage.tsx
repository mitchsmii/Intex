import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../services/apiService'
import type { Supporter, DonationRaw } from '../../services/apiService'
import { useAuth } from '../../hooks/useAuth'
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
  const safe = iso.includes('T') ? iso : iso + 'T00:00:00'
  return new Date(safe).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
  const { user } = useAuth()
  const [supporter, setSupporter] = useState<Supporter | null>(null)
  const [donations, setDonations] = useState<DonationRaw[]>([])
  const [loading,   setLoading]   = useState(true)
  const [notFound,  setNotFound]  = useState(false)

  useEffect(() => {
    if (!user?.email) {
      setLoading(false)
      return
    }
    setLoading(true)
    // Fetch supporter and donations in parallel; use email-based donation fetch so
    // all donations are found even if multiple supporter records share the same email.
    Promise.all([
      api.lookupSupporterByEmail(user.email),
      api.getDonationsByEmail(user.email),
    ])
      .then(([found, list]) => {
        setSupporter(found)
        setDonations(list)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [user])

  const totalUSD  = donations.reduce((s, d) => s + (d.amount ?? 0), 0)
  const currency  = donations[0]?.currencyCode ?? 'PHP'
  const tier      = donationTier(totalUSD)
  const streak    = givingStreak(donations)
  const since     = supporter ? memberSince(supporter.createdAt, donations) : '—'
  const impact    = supporter ? calcImpact(totalUSD) : []
  const sorted    = [...donations].sort((a, b) => {
    if (!a.donationDate) return 1
    if (!b.donationDate) return -1
    return new Date(b.donationDate).getTime() - new Date(a.donationDate).getTime()
  })

  // ── Loading ──
  if (loading) {
    return (
      <div className="dh-page">
        <div className="dh-lookup-wrap">
          <div className="dh-lookup-card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Loading your donation history…</div>
          </div>
        </div>
      </div>
    )
  }

  // ── No history found ──
  if (notFound || !supporter) {
    return (
      <div className="dh-page">
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
            <h1 className="dh-lookup-title">No Donation History Yet</h1>
            <p className="dh-lookup-sub">
              We couldn't find any donations linked to <strong>{user?.email}</strong>.
              Make your first donation to start building your giving history.
            </p>
            <Link to="/donate" className="dh-lookup-btn" style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}>
              Make a Donation
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Donor results ──
  return (
    <div className="dh-page">

      {/* Hero card */}
      <div className="dh-hero">
        <div className="dh-hero-left">
          <div className="dh-avatar">
            {supporter.firstName?.[0] ?? user?.email?.[0]?.toUpperCase() ?? '?'}{supporter.lastName?.[0] ?? ''}
          </div>
          <div>
            <div className="dh-hero-name">
              {supporter.firstName || supporter.lastName
                ? `${supporter.firstName ?? ''} ${supporter.lastName ?? ''}`.trim()
                : (user?.email ?? supporter.email ?? 'Donor')}
            </div>
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
                <td className="dh-td-amount">{fmtAmount(d.amount, d.currencyCode)}</td>
                <td>
                  <span className={`dh-tag ${d.isRecurring ? 'tag-monthly' : 'tag-onetime'}`}>
                    {d.isRecurring ? 'Monthly' : 'One-Time'}
                  </span>
                </td>
                <td className="dh-td-source">{d.channelSource ?? '—'}</td>
                <td>
                  <span className="dh-tag tag-complete">✓ Complete</span>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: 'var(--text-muted)', padding: '0.75rem' }}>
                  No donations found for this account.
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

    </div>
  )
}
