import { useState, useEffect } from 'react'
import { api } from '../../../services/apiService'
import type { Supporter, Donation } from '../../../services/apiService'
import '../ManageUsersPage.css'

const PARTNER_TYPES = ['Organization', 'NGO', 'Church', 'Corporate', 'Government', 'Foundation']

function fmtAmt(n: number | null, currency?: string | null) {
  if (n == null || n === 0) return '—'
  const sym = currency === 'USD' ? '$' : '₱'
  return sym + n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

type SortKey = 'name' | 'type' | 'region' | 'status' | 'total' | 'firstDate'
type Dir = 'asc' | 'desc'

function SortTh({ label, col, sort, dir, onSort }: {
  label: string; col: SortKey; sort: SortKey; dir: Dir; onSort: (c: SortKey) => void
}) {
  const active = sort === col
  return (
    <th className={`mu-th-sort${active ? ' mu-th-active' : ''}`} onClick={() => onSort(col)}>
      {label}<span className="mu-sort-icon">{active ? (dir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
    </th>
  )
}

export default function PartnersPage() {
  const [supporters, setSupporters] = useState<Supporter[]>([])
  const [donations,  setDonations]  = useState<Donation[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [sortCol,    setSortCol]    = useState<SortKey>('name')
  const [sortDir,    setSortDir]    = useState<Dir>('asc')

  useEffect(() => {
    Promise.allSettled([
      api.getSupporters().then(setSupporters),
      api.getDonations().then(setDonations),
    ]).finally(() => setLoading(false))
  }, [])

  const partners = supporters.filter(s =>
    s.supporterType && PARTNER_TYPES.some(t => (s.supporterType ?? '').toLowerCase().includes(t.toLowerCase()))
  )

  const totalBySupporter = (id: number) =>
    donations.filter(d => d.supporterId === id).reduce((s, d) => s + (d.amount ?? 0), 0)

  function toggleSort(col: SortKey) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const types = [...new Set(partners.map(p => p.supporterType).filter(Boolean))] as string[]

  const filtered = partners
    .filter(p => {
      const matchSearch = !search ||
        (p.displayName ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (p.organizationName ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (p.email ?? '').toLowerCase().includes(search.toLowerCase())
      const matchType = !typeFilter || (p.supporterType ?? '').includes(typeFilter)
      return matchSearch && matchType
    })
    .sort((a, b) => {
      let va = '', vb = ''
      const nameA = a.organizationName ?? a.displayName ?? `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim()
      const nameB = b.organizationName ?? b.displayName ?? `${b.firstName ?? ''} ${b.lastName ?? ''}`.trim()
      if      (sortCol === 'name')      { va = nameA; vb = nameB }
      else if (sortCol === 'type')      { va = a.supporterType ?? ''; vb = b.supporterType ?? '' }
      else if (sortCol === 'region')    { va = [a.region, a.country].filter(Boolean).join(', '); vb = [b.region, b.country].filter(Boolean).join(', ') }
      else if (sortCol === 'status')    { va = a.status ?? ''; vb = b.status ?? '' }
      else if (sortCol === 'total')     { return sortDir === 'asc' ? totalBySupporter(a.supporterId) - totalBySupporter(b.supporterId) : totalBySupporter(b.supporterId) - totalBySupporter(a.supporterId) }
      else if (sortCol === 'firstDate') { va = a.firstDonationDate ?? ''; vb = b.firstDonationDate ?? '' }
      const cmp = va.localeCompare(vb)
      return sortDir === 'asc' ? cmp : -cmp
    })

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
          <input className="mu-search" type="search" placeholder="Search partners…"
            value={search} onChange={e => setSearch(e.target.value)} />
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

      {loading ? <p className="mu-empty">Loading…</p> : (
        <div className="mu-card">
          <table className="mu-table">
            <thead>
              <tr>
                <SortTh label="Organization"      col="name"      sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Type"              col="type"      sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <th>Contact</th>
                <SortTh label="Region / Country"  col="region"    sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Status"            col="status"    sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Total Contributed" col="total"     sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="First Gift"        col="firstDate" sort={sortCol} dir={sortDir} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="mu-empty-cell">No partners found.</td></tr>
              )}
              {filtered.map(p => {
                const ds = donations.filter(d => d.supporterId === p.supporterId)
                const tot = totalBySupporter(p.supporterId)
                return (
                  <tr key={p.supporterId}>
                    <td className="mu-td-name">
                      {p.organizationName ?? p.displayName ?? (`${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || '—')}
                    </td>
                    <td><span className="mu-badge mu-badge-type">{p.supporterType ?? '—'}</span></td>
                    <td>
                      {p.email && <div className="mu-contact-line">{p.email}</div>}
                      {p.phone && <div className="mu-contact-line mu-muted">{p.phone}</div>}
                      {!p.email && !p.phone && '—'}
                    </td>
                    <td>{[p.region, p.country].filter(Boolean).join(', ') || '—'}</td>
                    <td><span className={`mu-badge ${p.status === 'Active' ? 'mu-badge-ok' : 'mu-badge-off'}`}>{p.status ?? '—'}</span></td>
                    <td className="mu-td-num">{ds.length ? fmtAmt(tot, ds[0]?.currencyCode) : '—'}</td>
                    <td>{p.firstDonationDate ? new Date(p.firstDonationDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
