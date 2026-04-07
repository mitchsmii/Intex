import { useState, useEffect } from 'react'
import { api } from '../../../services/apiService'
import type { Supporter, Donation } from '../../../services/apiService'
import '../ManageUsersPage.css'

const PARTNER_TYPES = ['Organization', 'NGO', 'Church', 'Corporate', 'Government', 'Foundation']

function fmtAmt(n: number | null, currency?: string | null) {
  if (n == null) return '—'
  const sym = currency === 'USD' ? '$' : '₱'
  return sym + n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

export default function PartnersPage() {
  const [supporters, setSupporters] = useState<Supporter[]>([])
  const [donations,  setDonations]  = useState<Donation[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  useEffect(() => {
    Promise.allSettled([
      api.getSupporters().then(setSupporters),
      api.getDonations().then(setDonations),
    ]).finally(() => setLoading(false))
  }, [])

  // Partners = supporters whose type is in PARTNER_TYPES or supporterType is 'Organization'
  const partners = supporters.filter(s =>
    s.supporterType && PARTNER_TYPES.some(t => (s.supporterType ?? '').toLowerCase().includes(t.toLowerCase()))
  )

  const totalBySupporter = (id: number) =>
    donations.filter(d => d.supporterId === id).reduce((s, d) => s + (d.amount ?? 0), 0)

  const filtered = partners.filter(p => {
    const matchSearch = !search ||
      (p.displayName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.organizationName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.email ?? '').toLowerCase().includes(search.toLowerCase())
    const matchType = !typeFilter || (p.supporterType ?? '').includes(typeFilter)
    return matchSearch && matchType
  })

  const types = [...new Set(partners.map(p => p.supporterType).filter(Boolean))] as string[]

  return (
    <div className="mu-page">
      <div className="mu-header">
        <div>
          <h1 className="mu-title">Partners &amp; Organizations</h1>
          <p className="mu-subtitle">{partners.length} partner organizations on record</p>
        </div>
        <div className="mu-header-actions">
          <select className="mu-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            className="mu-search"
            type="search"
            placeholder="Search partners…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="mu-kpi-row">
        {[
          { label: 'Total Partners', value: String(partners.length) },
          { label: 'Active', value: String(partners.filter(p => p.status === 'Active').length) },
          { label: 'With Donations', value: String(partners.filter(p => donations.some(d => d.supporterId === p.supporterId)).length) },
          { label: 'Unique Types', value: String(types.length) },
        ].map(k => (
          <div key={k.label} className="mu-kpi">
            <div className="mu-kpi-value">{k.value}</div>
            <div className="mu-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="mu-empty">Loading…</p>
      ) : (
        <div className="mu-card">
          <table className="mu-table">
            <thead>
              <tr>
                <th>Organization</th>
                <th>Type</th>
                <th>Contact</th>
                <th>Region / Country</th>
                <th>Status</th>
                <th>Total Contributed</th>
                <th>First Gift</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="mu-empty-cell">No partners found.</td></tr>
              )}
              {filtered.map(p => (
                <tr key={p.supporterId}>
                  <td className="mu-td-name">
                    {p.organizationName ?? p.displayName ?? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim()}
                  </td>
                  <td>
                    <span className="mu-badge mu-badge-type">{p.supporterType ?? '—'}</span>
                  </td>
                  <td>
                    {p.email && <div className="mu-contact-line">{p.email}</div>}
                    {p.phone && <div className="mu-contact-line mu-muted">{p.phone}</div>}
                    {!p.email && !p.phone && '—'}
                  </td>
                  <td>{[p.region, p.country].filter(Boolean).join(', ') || '—'}</td>
                  <td>
                    <span className={`mu-badge ${p.status === 'Active' ? 'mu-badge-ok' : 'mu-badge-off'}`}>
                      {p.status ?? '—'}
                    </span>
                  </td>
                  <td className="mu-td-num">
                    {(() => {
                      const ds = donations.filter(d => d.supporterId === p.supporterId)
                      const tot = totalBySupporter(p.supporterId)
                      return ds.length ? fmtAmt(tot, ds[0]?.currencyCode) : '—'
                    })()}
                  </td>
                  <td>{p.firstDonationDate ? new Date(p.firstDonationDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
